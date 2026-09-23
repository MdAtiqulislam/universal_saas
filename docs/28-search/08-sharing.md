# 08 — View Sharing & Collaboration

## Sharing Model

Views with `visibility = SHARED` define explicit access grants via `SavedViewShare`:

- `shareType`: `USER` | `ROLE` | `ORGANIZATION`
- `targetId`: Target user UUID or role identifier
- `permission`: `VIEW` | `EDIT` | `ADMIN`

## Tenant Boundary Verification (`INV-492`)

When sharing a view with another user, `SavedViewsService.shareSavedView` actively queries `OrganizationMember`:

```typescript
const targetUser = await this.prisma.organizationMember.findFirst({
  where: {
    organizationId,
    userId: dto.targetId,
    status: "ACTIVE",
  },
});
if (!targetUser) {
  throw new BadRequestException("Target user does not belong to this organization (INV-492)");
}
```

Cross-tenant sharing attempts are strictly rejected.
