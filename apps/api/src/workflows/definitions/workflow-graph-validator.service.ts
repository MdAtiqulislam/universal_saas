import { Injectable, BadRequestException } from '@nestjs/common';
import { WorkflowNodeType } from '@prisma/client';

export interface GraphNodeInput {
  id?: string;
  nodeKey: string;
  nodeType: WorkflowNodeType;
  label: string;
  config?: Record<string, unknown> | null;
}

export interface GraphEdgeInput {
  id?: string;
  sourceNodeKey: string;
  targetNodeKey: string;
  conditionRuleId?: string | null;
  conditionExpression?: Record<string, unknown> | null;
  priority?: number;
}

export interface GraphValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  nodeCount: number;
  edgeCount: number;
}

@Injectable()
export class WorkflowGraphValidatorService {
  validateGraph(
    nodes: GraphNodeInput[],
    edges: GraphEdgeInput[],
  ): GraphValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!nodes || nodes.length === 0) {
      return {
        valid: false,
        errors: ['Workflow graph must contain at least one node'],
        warnings: [],
        nodeCount: 0,
        edgeCount: 0,
      };
    }

    const nodeKeyMap = new Map<string, GraphNodeInput>();
    const startNodes: GraphNodeInput[] = [];
    const endNodes: GraphNodeInput[] = [];

    for (const node of nodes) {
      if (!node.nodeKey || typeof node.nodeKey !== 'string') {
        errors.push('Every node must possess a valid unique nodeKey');
        continue;
      }
      if (nodeKeyMap.has(node.nodeKey)) {
        errors.push(`Duplicate nodeKey detected in graph: "${node.nodeKey}"`);
      }
      nodeKeyMap.set(node.nodeKey, node);

      if (node.nodeType === 'START') {
        startNodes.push(node);
      } else if (node.nodeType === 'END') {
        endNodes.push(node);
      } else if (node.nodeType === 'APPROVAL') {
        if (
          !node.config ||
          typeof node.config !== 'object' ||
          !node.config.approverTarget
        ) {
          errors.push(
            `Approval node "${node.nodeKey}" must define an approverTarget in its configuration`,
          );
        }
      } else if (node.nodeType === 'ACTION') {
        if (
          !node.config ||
          typeof node.config !== 'object' ||
          !node.config.actionType
        ) {
          errors.push(
            `Action node "${node.nodeKey}" must define an actionType in its configuration`,
          );
        }
      }
    }

    // INV-384: Exactly one START node
    if (startNodes.length === 0) {
      errors.push('Workflow must contain exactly one START node (INV-384)');
    } else if (startNodes.length > 1) {
      errors.push(
        `Workflow contains multiple START nodes (${startNodes.length}). Exactly one START node is permitted (INV-384)`,
      );
    }

    // INV-385: At least one END node
    if (endNodes.length === 0) {
      errors.push('Workflow must contain at least one END node (INV-385)');
    }

    // Build adjacency lists
    const outgoing = new Map<string, string[]>();
    const incoming = new Map<string, string[]>();

    for (const nodeKey of nodeKeyMap.keys()) {
      outgoing.set(nodeKey, []);
      incoming.set(nodeKey, []);
    }

    // INV-387: Edges reference valid source and target nodes
    for (const edge of edges || []) {
      if (!nodeKeyMap.has(edge.sourceNodeKey)) {
        errors.push(
          `Edge references non-existent source nodeKey: "${edge.sourceNodeKey}" (INV-387)`,
        );
        continue;
      }
      if (!nodeKeyMap.has(edge.targetNodeKey)) {
        errors.push(
          `Edge references non-existent target nodeKey: "${edge.targetNodeKey}" (INV-387)`,
        );
        continue;
      }

      outgoing.get(edge.sourceNodeKey)!.push(edge.targetNodeKey);
      incoming.get(edge.targetNodeKey)!.push(edge.sourceNodeKey);
    }

    // Check reachability from START node
    if (startNodes.length === 1) {
      const startKey = startNodes[0].nodeKey;
      const reachableFromStart = new Set<string>();
      const queue: string[] = [startKey];
      reachableFromStart.add(startKey);

      while (queue.length > 0) {
        const curr = queue.shift()!;
        const neighbors = outgoing.get(curr) || [];
        for (const next of neighbors) {
          if (!reachableFromStart.has(next)) {
            reachableFromStart.add(next);
            queue.push(next);
          }
        }
      }

      // INV-386: No orphan nodes unreachable from START
      for (const nodeKey of nodeKeyMap.keys()) {
        if (!reachableFromStart.has(nodeKey)) {
          errors.push(
            `Orphan executable node detected: "${nodeKey}" is not reachable from START node (INV-386)`,
          );
        }
      }

      // Check that at least one END node is reachable from START
      const reachableEnd = endNodes.some((endNode) =>
        reachableFromStart.has(endNode.nodeKey),
      );
      if (!reachableEnd) {
        errors.push('No END node is reachable from the START node (INV-385)');
      }
    }

    // START node should not have incoming edges
    if (startNodes.length === 1) {
      const startIncoming = incoming.get(startNodes[0].nodeKey) || [];
      if (startIncoming.length > 0) {
        errors.push('START node cannot have incoming edges');
      }
    }

    // END nodes should not have outgoing edges
    for (const endNode of endNodes) {
      const endOutgoing = outgoing.get(endNode.nodeKey) || [];
      if (endOutgoing.length > 0) {
        errors.push(`END node "${endNode.nodeKey}" cannot have outgoing edges`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      nodeCount: nodes.length,
      edgeCount: edges.length,
    };
  }

  assertValidGraph(nodes: GraphNodeInput[], edges: GraphEdgeInput[]): void {
    const result = this.validateGraph(nodes, edges);
    if (!result.valid) {
      throw new BadRequestException({
        message: 'Workflow graph validation failed',
        errors: result.errors,
      });
    }
  }
}
