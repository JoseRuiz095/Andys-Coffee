## Table `_prisma_migrations`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `varchar` | Primary |
| `checksum` | `varchar` |  |
| `finished_at` | `timestamptz` |  Nullable |
| `migration_name` | `varchar` |  |
| `logs` | `text` |  Nullable |
| `rolled_back_at` | `timestamptz` |  Nullable |
| `started_at` | `timestamptz` |  |
| `applied_steps_count` | `int4` |  |

## Table `users`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `name` | `text` |  |
| `email` | `text` |  |
| `passwordHash` | `text` |  |
| `isActive` | `bool` |  |
| `roleId` | `text` |  |
| `createdAt` | `timestamp` |  |
| `updatedAt` | `timestamp` |  |

## Table `roles`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `name` | `text` |  |
| `description` | `text` |  Nullable |
| `createdAt` | `timestamp` |  |
| `updatedAt` | `timestamp` |  |

## Table `permissions`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `name` | `text` |  |
| `description` | `text` |  Nullable |
| `createdAt` | `timestamp` |  |
| `updatedAt` | `timestamp` |  |

## Table `role_permissions`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `roleId` | `text` | Primary |
| `permissionId` | `text` | Primary |
| `createdAt` | `timestamp` |  |

## Table `categories`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `name` | `text` |  |
| `description` | `text` |  Nullable |
| `imageUrl` | `text` |  Nullable |
| `displayOrder` | `int4` |  |
| `isActive` | `bool` |  |
| `createdAt` | `timestamptz` |  |
| `updatedAt` | `timestamptz` |  |

## Table `products`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `categoryId` | `text` |  Nullable |
| `name` | `text` |  |
| `description` | `text` |  Nullable |
| `sku` | `text` |  Nullable |
| `imageUrl` | `text` |  Nullable |
| `price` | `numeric` |  |
| `cost` | `numeric` |  |
| `isActive` | `bool` |  |
| `displayOrder` | `int4` |  |
| `createdAt` | `timestamptz` |  |
| `updatedAt` | `timestamptz` |  |

## Table `extras`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `name` | `text` |  |
| `description` | `text` |  Nullable |
| `price` | `numeric` |  |
| `cost` | `numeric` |  |
| `isActive` | `bool` |  |
| `createdAt` | `timestamptz` |  |
| `updatedAt` | `timestamptz` |  |

## Table `productExtras`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `productId` | `text` | Primary |
| `extraId` | `text` | Primary |
| `isDefault` | `bool` |  |
| `createdAt` | `timestamptz` |  |

## Table `combos`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `name` | `text` |  |
| `description` | `text` |  Nullable |
| `price` | `numeric` |  |
| `imageUrl` | `text` |  Nullable |
| `isActive` | `bool` |  |
| `createdAt` | `timestamptz` |  |
| `updatedAt` | `timestamptz` |  |

## Table `comboItems`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `comboId` | `text` |  |
| `productId` | `text` |  |
| `quantity` | `numeric` |  |
| `createdAt` | `timestamptz` |  |

## Table `inventoryUnits`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `name` | `text` |  |
| `abbreviation` | `text` |  |
| `createdAt` | `timestamptz` |  |

## Table `ingredients`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `name` | `text` |  |
| `sku` | `text` |  Nullable |
| `unitId` | `text` |  |
| `currentStock` | `numeric` |  |
| `minimumStock` | `numeric` |  |
| `averageCost` | `numeric` |  |
| `isActive` | `bool` |  |
| `createdAt` | `timestamptz` |  |
| `updatedAt` | `timestamptz` |  |

## Table `recipes`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `productId` | `text` |  |
| `ingredientId` | `text` |  |
| `quantity` | `numeric` |  |
| `createdAt` | `timestamptz` |  |
| `updatedAt` | `timestamptz` |  |

## Table `extraRecipes`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `extraId` | `text` |  |
| `ingredientId` | `text` |  |
| `quantity` | `numeric` |  |
| `createdAt` | `timestamptz` |  |

## Table `inventoryMovements`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `ingredientId` | `text` |  |
| `type` | `text` |  |
| `quantity` | `numeric` |  |
| `unitCost` | `numeric` |  |
| `referenceType` | `text` |  Nullable |
| `referenceId` | `text` |  Nullable |
| `notes` | `text` |  Nullable |
| `createdById` | `text` |  Nullable |
| `createdAt` | `timestamptz` |  |

## Table `suppliers`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `name` | `text` |  |
| `phone` | `text` |  Nullable |
| `email` | `text` |  Nullable |
| `address` | `text` |  Nullable |
| `isActive` | `bool` |  |
| `createdAt` | `timestamptz` |  |
| `updatedAt` | `timestamptz` |  |

## Table `purchases`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `supplierId` | `text` |  Nullable |
| `invoiceNumber` | `text` |  Nullable |
| `status` | `text` |  |
| `subtotal` | `numeric` |  |
| `tax` | `numeric` |  |
| `total` | `numeric` |  |
| `notes` | `text` |  Nullable |
| `purchasedAt` | `timestamptz` |  |
| `createdById` | `text` |  Nullable |
| `createdAt` | `timestamptz` |  |
| `updatedAt` | `timestamptz` |  |

## Table `purchaseItems`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `purchaseId` | `text` |  |
| `ingredientId` | `text` |  |
| `quantity` | `numeric` |  |
| `unitCost` | `numeric` |  |
| `total` | `numeric` |  Nullable |
| `createdAt` | `timestamptz` |  |

## Table `cashRegisters`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `name` | `text` |  |
| `description` | `text` |  Nullable |
| `isActive` | `bool` |  |
| `createdAt` | `timestamptz` |  |
| `updatedAt` | `timestamptz` |  |

## Table `cashSessions`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `cashRegisterId` | `text` |  |
| `openedById` | `text` |  |
| `closedById` | `text` |  Nullable |
| `openingAmount` | `numeric` |  |
| `expectedAmount` | `numeric` |  |
| `closingAmount` | `numeric` |  Nullable |
| `difference` | `numeric` |  Nullable |
| `status` | `text` |  |
| `openedAt` | `timestamptz` |  |
| `closedAt` | `timestamptz` |  Nullable |

## Table `cashMovements`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `cashSessionId` | `text` |  |
| `type` | `text` |  |
| `amount` | `numeric` |  |
| `referenceType` | `text` |  Nullable |
| `referenceId` | `text` |  Nullable |
| `description` | `text` |  Nullable |
| `createdById` | `text` |  Nullable |
| `createdAt` | `timestamptz` |  |

## Table `expenses`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `cashSessionId` | `text` |  Nullable |
| `category` | `text` |  |
| `description` | `text` |  |
| `amount` | `numeric` |  |
| `expenseDate` | `timestamptz` |  |
| `createdById` | `text` |  Nullable |
| `createdAt` | `timestamptz` |  |

## Table `orders`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `orderNumber` | `int8` |  Unique Identity |
| `cashSessionId` | `text` |  Nullable |
| `status` | `text` |  |
| `customerName` | `text` |  Nullable |
| `subtotal` | `numeric` |  |
| `discount` | `numeric` |  |
| `tax` | `numeric` |  |
| `total` | `numeric` |  |
| `notes` | `text` |  Nullable |
| `inventoryProcessed` | `bool` |  |
| `createdById` | `text` |  Nullable |
| `createdAt` | `timestamptz` |  |
| `updatedAt` | `timestamptz` |  |
| `completedAt` | `timestamptz` |  Nullable |

## Table `orderItems`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `orderId` | `text` |  |
| `productId` | `text` |  Nullable |
| `comboId` | `text` |  Nullable |
| `productName` | `text` |  |
| `quantity` | `numeric` |  |
| `unitPrice` | `numeric` |  |
| `discount` | `numeric` |  |
| `subtotal` | `numeric` |  |
| `notes` | `text` |  Nullable |
| `createdAt` | `timestamptz` |  |
| `costSnapshot` | `numeric` |  |

## Table `orderItemExtras`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `orderItemId` | `text` |  |
| `extraId` | `text` |  Nullable |
| `extraName` | `text` |  |
| `quantity` | `numeric` |  |
| `unitPrice` | `numeric` |  |
| `subtotal` | `numeric` |  |
| `createdAt` | `timestamptz` |  |
| `costSnapshot` | `numeric` |  |

## Table `payments`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `orderId` | `text` |  |
| `method` | `text` |  |
| `amount` | `numeric` |  |
| `status` | `text` |  |
| `reference` | `text` |  Nullable |
| `paidAt` | `timestamptz` |  |
| `createdById` | `text` |  Nullable |
| `createdAt` | `timestamptz` |  |

## Table `tickets`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `text` | Primary |
| `orderId` | `text` |  Unique |
| `ticketNumber` | `int8` |  Unique Identity |
| `printedAt` | `timestamptz` |  Nullable |
| `createdAt` | `timestamptz` |  |

