import { WorkflowGraphValidatorService } from '../definitions/workflow-graph-validator.service';
import {
  NodeInputDto,
  EdgeInputDto,
} from '../versions/dto/create-workflow-version.dto';

describe('WorkflowGraphValidatorService (M40)', () => {
  let validator: WorkflowGraphValidatorService;

  beforeEach(() => {
    validator = new WorkflowGraphValidatorService();
  });

  it('passes validation for a valid DAG topology (INV-384, INV-385, INV-386)', () => {
    const nodes: NodeInputDto[] = [
      { nodeKey: 'start_1', nodeType: 'START', label: 'Start' },
      {
        nodeKey: 'cond_1',
        nodeType: 'CONDITION',
        label: 'Condition',
      },
      {
        nodeKey: 'act_1',
        nodeType: 'ACTION',
        label: 'Action',
        config: { actionType: 'create_notification' },
      },
      { nodeKey: 'end_1', nodeType: 'END', label: 'End' },
    ];

    const edges: EdgeInputDto[] = [
      { sourceNodeKey: 'start_1', targetNodeKey: 'cond_1' },
      { sourceNodeKey: 'cond_1', targetNodeKey: 'act_1' },
      { sourceNodeKey: 'act_1', targetNodeKey: 'end_1' },
    ];

    const result = validator.validateGraph(nodes, edges);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails if there are multiple START nodes (INV-384)', () => {
    const nodes: NodeInputDto[] = [
      { nodeKey: 'start_1', nodeType: 'START', label: 'Start 1' },
      { nodeKey: 'start_2', nodeType: 'START', label: 'Start 2' },
      { nodeKey: 'end_1', nodeType: 'END', label: 'End' },
    ];
    const edges: EdgeInputDto[] = [
      { sourceNodeKey: 'start_1', targetNodeKey: 'end_1' },
      { sourceNodeKey: 'start_2', targetNodeKey: 'end_1' },
    ];

    const result = validator.validateGraph(nodes, edges);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some(
        (e) => e.includes('multiple START nodes') || e.includes('INV-384'),
      ),
    ).toBe(true);
  });

  it('fails if there is no reachable END node (INV-385)', () => {
    const nodes: NodeInputDto[] = [
      { nodeKey: 'start_1', nodeType: 'START', label: 'Start' },
      {
        nodeKey: 'act_1',
        nodeType: 'ACTION',
        label: 'Action',
        config: { actionType: 'create_notification' },
      },
    ];
    const edges: EdgeInputDto[] = [
      { sourceNodeKey: 'start_1', targetNodeKey: 'act_1' },
    ];

    const result = validator.validateGraph(nodes, edges);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some(
        (e) => e.includes('at least one END node') || e.includes('INV-385'),
      ),
    ).toBe(true);
  });

  it('fails if there is an orphaned node without transitions (INV-386)', () => {
    const nodes: NodeInputDto[] = [
      { nodeKey: 'start_1', nodeType: 'START', label: 'Start' },
      { nodeKey: 'end_1', nodeType: 'END', label: 'End' },
      {
        nodeKey: 'orphan_act',
        nodeType: 'ACTION',
        label: 'Orphan',
        config: { actionType: 'create_notification' },
      },
    ];
    const edges: EdgeInputDto[] = [
      { sourceNodeKey: 'start_1', targetNodeKey: 'end_1' },
    ];

    const result = validator.validateGraph(nodes, edges);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes('Orphan') || e.includes('INV-386')),
    ).toBe(true);
  });

  it('fails if an edge references a non-existent node (INV-387)', () => {
    const nodes: NodeInputDto[] = [
      { nodeKey: 'start_1', nodeType: 'START', label: 'Start' },
      { nodeKey: 'end_1', nodeType: 'END', label: 'End' },
    ];
    const edges: EdgeInputDto[] = [
      { sourceNodeKey: 'start_1', targetNodeKey: 'non_existent_node' },
    ];

    const result = validator.validateGraph(nodes, edges);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some(
        (e) => e.includes('non-existent') && e.includes('INV-387'),
      ),
    ).toBe(true);
  });
});
