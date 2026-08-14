-- ============================================================
-- ANDY'S COFFEE - SEED SCRIPT
-- ============================================================
-- Este script inserta las categorías y productos iniciales
-- en la base de datos.
-- ============================================================

-- 1. Insertar Categorías
-- Se usa ON CONFLICT para evitar errores si se ejecuta múltiples veces.
INSERT INTO public.categories (id, name, description, "isActive", "displayOrder", "createdAt", "updatedAt") VALUES
('cat-bebidas', 'Bebidas', 'Café, té y otras bebidas calientes y frías.', true, 1, NOW(), NOW()),
('cat-bagels', 'Bagels', 'Bagels artesanales con diferentes rellenos.', true, 2, NOW(), NOW()),
('cat-desayunos', 'Desayunos', 'Platillos completos para empezar el día.', true, 3, NOW(), NOW()),
('cat-promociones', 'Promociones', 'Combos y ofertas especiales.', true, 4, NOW(), NOW()),
('cat-otros', 'Otros', 'Productos adicionales y de temporada.', true, 5, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 2. Insertar Productos
-- Los costos son estimados y puedes ajustarlos según sea necesario.
INSERT INTO public.products (id, "categoryId", name, description, sku, price, cost, "imageUrl", "isActive", "displayOrder", "createdAt", "updatedAt") VALUES
-- Bebidas
('prod-1', 'cat-bebidas', 'Espresso', 'Café solo, intenso y aromático.', 'BEV-001', 35.00, 7.00, 'https://images.unsplash.com/photo-1579929336849-e6a4a8f3dd7e?q=80&w=1974&auto=format&fit=crop', true, 1, NOW(), NOW()),
('prod-2', 'cat-bebidas', 'Latte regular', 'Espresso con leche vaporizada y una fina capa de espuma.', 'BEV-002', 45.00, 9.00, 'https://images.unsplash.com/photo-1561882468-91101f2dfc7b?q=80&w=2127&auto=format&fit=crop', true, 2, NOW(), NOW()),
('prod-3', 'cat-bebidas', 'Latte Vainilla', 'Latte endulzado con jarabe de vainilla.', 'BEV-003', 50.00, 10.00, 'https://images.unsplash.com/photo-1599399125932-651a462435c9?q=80&w=1974&auto=format&fit=crop', true, 3, NOW(), NOW()),
('prod-4', 'cat-bebidas', 'Latte Caramel Macciato', 'Espresso, leche vaporizada, vainilla y un toque de caramelo.', 'BEV-004', 55.00, 11.00, 'https://images.unsplash.com/photo-1576092762791-d62c15f3b2ca?q=80&w=1974&auto=format&fit=crop', true, 4, NOW(), NOW()),
('prod-5', 'cat-bebidas', 'Latte Moka', 'La combinación perfecta de espresso, chocolate y leche.', 'BEV-005', 55.00, 11.50, 'https://images.unsplash.com/photo-1607260550779-7b7iginal.jpg?q=80&w=1974&auto=format&fit=crop', true, 5, NOW(), NOW()),
('prod-6', 'cat-bebidas', 'Latte Biscoff', 'Un delicioso latte con el sabor único de la galleta Biscoff.', 'BEV-006', 60.00, 12.00, 'https://plus.unsplash.com/premium_photo-1675435633349-5a5e4a1d8b32?q=80&w=1974&auto=format&fit=crop', true, 6, NOW(), NOW()),
('prod-7', 'cat-bebidas', 'Latte Andy''s', 'La especialidad de la casa, un secreto delicioso.', 'BEV-007', 65.00, 13.00, 'https://images.unsplash.com/photo-1517701559498-006c54958d55?q=80&w=1964&auto=format&fit=crop', true, 7, NOW(), NOW()),
('prod-8', 'cat-bebidas', 'Americano', 'Espresso diluido con agua caliente, suave pero con carácter.', 'BEV-008', 35.00, 6.50, 'https://images.unsplash.com/photo-1559496417-e7f40064c782?q=80&w=1974&auto=format&fit=crop', true, 8, NOW(), NOW()),
('prod-9', 'cat-bebidas', 'Latte regular Frio', 'Nuestro clásico latte, pero refrescante y con hielo.', 'BEV-009', 48.00, 9.50, 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?q=80&w=2069&auto=format&fit=crop', true, 9, NOW(), NOW()),
('prod-10', 'cat-bebidas', 'Latte Vainilla Frio', 'La dulzura de la vainilla en un latte helado.', 'BEV-010', 53.00, 10.50, 'https://images.unsplash.com/photo-1553909489-cd47e0907910?q=80&w=1974&auto=format&fit=crop', true, 10, NOW(), NOW()),
('prod-11', 'cat-bebidas', 'Latte Caramel Macciato Frio', 'La versión helada de nuestro popular Caramel Macchiato.', 'BEV-011', 58.00, 11.50, 'https://images.unsplash.com/photo-1594212699903-c82ab5d88349?q=80&w=1974&auto=format&fit=crop', true, 11, NOW(), NOW()),
('prod-12', 'cat-bebidas', 'Latte Biscoff Frio', 'Galleta Biscoff y café en una bebida fría irresistible.', 'BEV-012', 63.00, 12.50, 'https://images.unsplash.com/photo-1610890435899-a5135a415a78?q=80&w=1974&auto=format&fit=crop', true, 12, NOW(), NOW()),
('prod-13', 'cat-bebidas', 'Latte Moka Frio', 'Chocolate y café en una refrescante bebida helada.', 'BEV-013', 58.00, 12.00, 'https://images.unsplash.com/photo-1525088553748-01d6e210604d?q=80&w=1974&auto=format&fit=crop', true, 13, NOW(), NOW()),
('prod-14', 'cat-bebidas', 'Latte Andy''s Frio', 'Nuestra especialidad secreta, ahora en versión fría.', 'BEV-014', 68.00, 14.00, 'https://images.unsplash.com/photo-1592201131135-f655a85537a2?q=80&w=1974&auto=format&fit=crop', true, 14, NOW(), NOW()),
('prod-15', 'cat-bebidas', 'Americano Iced', 'Un americano clásico servido con hielo.', 'BEV-015', 38.00, 7.00, 'https://images.unsplash.com/photo-1517701559498-006c54958d55?q=80&w=1964&auto=format&fit=crop', true, 15, NOW(), NOW()),
('prod-16', 'cat-bebidas', 'Coffee Cream', 'Bebida cremosa de café, suave y deliciosa.', 'BEV-016', 60.00, 12.50, 'https://images.unsplash.com/photo-1507133750040-4a8f570215de?q=80&w=1974&auto=format&fit=crop', true, 16, NOW(), NOW()),
('prod-17', 'cat-bebidas', 'Chai vainilla frio', 'Té chai con un toque de vainilla, servido frío.', 'BEV-017', 55.00, 11.00, 'https://images.unsplash.com/photo-1595842793394-b342a19e4a40?q=80&w=1974&auto=format&fit=crop', true, 17, NOW(), NOW()),
('prod-18', 'cat-bebidas', 'Chai vainilla', 'Té chai especiado con leche y un toque de vainilla.', 'BEV-018', 52.00, 10.50, 'https://images.unsplash.com/photo-1578899695329-9698d2a33a8b?q=80&w=1974&auto=format&fit=crop', true, 18, NOW(), NOW()),
('prod-19', 'cat-bebidas', 'Chai guayaba frío', 'Una exótica combinación de té chai y guayaba, servida fría.', 'BEV-019', 55.00, 11.50, 'https://images.unsplash.com/photo-1623013343435-a3a2a65a35f5?q=80&w=1974&auto=format&fit=crop', true, 19, NOW(), NOW()),
('prod-20', 'cat-bebidas', 'Chai guayaba', 'Té chai caliente con el sabor tropical de la guayaba.', 'BEV-020', 52.00, 11.00, 'https://images.unsplash.com/photo-1622027242903-8ddd79b44f4e?q=80&w=1974&auto=format&fit=crop', true, 20, NOW(), NOW()),
('prod-41', 'cat-bebidas', 'Limonada', 'Refrescante limonada natural.', 'BEV-041', 40.00, 8.00, 'https://images.unsplash.com/photo-1600093966784-48c9e43a4a75?q=80&w=1974&auto=format&fit=crop', true, 21, NOW(), NOW()),
('prod-42', 'cat-bebidas', 'Bloom', 'Bebida floral y refrescante, especialidad de la casa.', 'BEV-042', 50.00, 10.00, 'https://images.unsplash.com/photo-1621442493101-bf4c45a73849?q=80&w=1974&auto=format&fit=crop', true, 22, NOW(), NOW()),
('prod-43', 'cat-bebidas', 'Refresher Limon-Fresa', 'Bebida refrescante con limón y fresa.', 'BEV-043', 55.00, 11.00, 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a7?q=80&w=1974&auto=format&fit=crop', true, 23, NOW(), NOW()),
-- Bagels
('prod-21', 'cat-bagels', 'Bagel campirano', 'Bagel con ingredientes frescos del campo.', 'BAG-001', 75.00, 25.00, 'https://images.unsplash.com/photo-1598679253351-d3a610d3e1e2?q=80&w=1974&auto=format&fit=crop', true, 1, NOW(), NOW()),
('prod-22', 'cat-bagels', 'Bagel de pollo', 'Delicioso bagel relleno de pollo marinado.', 'BAG-002', 85.00, 28.00, 'https://images.unsplash.com/photo-1625194659729-51b9952497f6?q=80&w=1974&auto=format&fit=crop', true, 2, NOW(), NOW()),
('prod-23', 'cat-bagels', 'Bagel americano', 'El clásico bagel con huevo, tocino y queso.', 'BAG-003', 80.00, 26.00, 'https://images.unsplash.com/photo-1551843426-d4772a8a73d3?q=80&w=1974&auto=format&fit=crop', true, 3, NOW(), NOW()),
('prod-24', 'cat-bagels', 'Bagel carnivoro', 'Para los amantes de la carne, con una mezcla de carnes frías.', 'BAG-004', 90.00, 30.00, 'https://images.unsplash.com/photo-1607013251379-e6eecfffe234?q=80&w=1974&auto=format&fit=crop', true, 4, NOW(), NOW()),
('prod-40', 'cat-bagels', 'Mini bagel philadelphia', 'Pequeño bagel con queso crema Philadelphia.', 'BAG-005', 45.00, 15.00, 'https://images.unsplash.com/photo-1628834997028-9a8d29a5a73c?q=80&w=1974&auto=format&fit=crop', true, 5, NOW(), NOW()),
-- Desayunos
('prod-25', 'cat-desayunos', 'Chilaquiles naturales rojos', 'Totopos bañados en salsa roja, con crema y queso.', 'DES-001', 90.00, 30.00, 'https://images.unsplash.com/photo-1605696192993-994b884a8f3c?q=80&w=1974&auto=format&fit=crop', true, 1, NOW(), NOW()),
('prod-26', 'cat-desayunos', 'Chilaquiles naturales verdes', 'Totopos bañados en salsa verde, con crema y queso.', 'DES-002', 90.00, 30.00, 'https://images.unsplash.com/photo-1605696192993-994b884a8f3c?q=80&w=1974&auto=format&fit=crop', true, 2, NOW(), NOW()),
('prod-27', 'cat-desayunos', 'Chilaquiles pollo rojos', 'Chilaquiles rojos con pollo deshebrado.', 'DES-003', 110.00, 35.00, 'https://images.unsplash.com/photo-1605696192993-994b884a8f3c?q=80&w=1974&auto=format&fit=crop', true, 3, NOW(), NOW()),
('prod-28', 'cat-desayunos', 'Chilaquiles pollo verdes', 'Chilaquiles verdes con pollo deshebrado.', 'DES-004', 110.00, 35.00, 'https://images.unsplash.com/photo-1605696192993-994b884a8f3c?q=80&w=1974&auto=format&fit=crop', true, 4, NOW(), NOW()),
('prod-29', 'cat-desayunos', 'Chilaquiles huevo rojos', 'Chilaquiles rojos acompañados de huevo estrellado o revuelto.', 'DES-005', 105.00, 33.00, 'https://images.unsplash.com/photo-1605696192993-994b884a8f3c?q=80&w=1974&auto=format&fit=crop', true, 5, NOW(), NOW()),
('prod-30', 'cat-desayunos', 'Chilaquiles huevo verdes', 'Chilaquiles verdes acompañados de huevo estrellado o revuelto.', 'DES-006', 105.00, 33.00, 'https://images.unsplash.com/photo-1605696192993-994b884a8f3c?q=80&w=1974&auto=format&fit=crop', true, 6, NOW(), NOW()),
('prod-31', 'cat-desayunos', 'Chilaquiles arrachera rojos', 'Chilaquiles rojos con jugosa arrachera.', 'DES-007', 140.00, 45.00, 'https://images.unsplash.com/photo-1605696192993-994b884a8f3c?q=80&w=1974&auto=format&fit=crop', true, 7, NOW(), NOW()),
('prod-32', 'cat-desayunos', 'Chilaquiles arrachera verdes', 'Chilaquiles verdes con jugosa arrachera.', 'DES-008', 140.00, 45.00, 'https://images.unsplash.com/photo-1605696192993-994b884a8f3c?q=80&w=1974&auto=format&fit=crop', true, 8, NOW(), NOW()),
('prod-33', 'cat-desayunos', 'Canadiense', 'Desayuno completo estilo canadiense.', 'DES-009', 120.00, 40.00, 'https://images.unsplash.com/photo-1525351484163-7529414344d8?q=80&w=2080&auto=format&fit=crop', true, 9, NOW(), NOW()),
('prod-34', 'cat-desayunos', 'Viajero', 'Un desayuno práctico y delicioso para llevar.', 'DES-010', 95.00, 32.00, 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?q=80&w=1910&auto=format&fit=crop', true, 10, NOW(), NOW()),
('prod-35', 'cat-desayunos', 'Duo continental', 'Desayuno ligero con pan, mermelada y café.', 'DES-011', 85.00, 28.00, 'https://images.unsplash.com/photo-1490004803954-2597430dd5a3?q=80&w=2070&auto=format&fit=crop', true, 11, NOW(), NOW()),
-- Promociones
('prod-36', 'cat-promociones', 'Promo Latte Andy´s 2x1', 'Disfruta de dos Lattes Andy''s al precio de uno.', 'PRO-001', 65.00, 26.00, 'https://images.unsplash.com/photo-1517701559498-006c54958d55?q=80&w=1964&auto=format&fit=crop', true, 1, NOW(), NOW()),
('prod-37', 'cat-promociones', 'Promo BomDia', 'Café americano y croissant por un precio especial.', 'PRO-002', 60.00, 20.00, 'https://images.unsplash.com/photo-1555949182-b8972353b149?q=80&w=2070&auto=format&fit=crop', true, 2, NOW(), NOW()),
('prod-38', 'cat-promociones', '4to desayuno gratis (Viajero)', 'Acumula 3 desayunos Viajero y el 4to es gratis.', 'PRO-003', 0.00, 32.00, 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?q=80&w=1910&auto=format&fit=crop', true, 3, NOW(), NOW()),
('prod-39', 'cat-promociones', 'Promo mochilero', 'Bagel americano y refresco a precio de paquete.', 'PRO-004', 95.00, 35.00, 'https://images.unsplash.com/photo-1551843426-d4772a8a73d3?q=80&w=1974&auto=format&fit=crop', true, 4, NOW(), NOW()),
('prod-44', 'cat-promociones', 'Promo limonadas', 'Dos limonadas por un precio especial.', 'PRO-005', 70.00, 16.00, 'https://images.unsplash.com/photo-1600093966784-48c9e43a4a75?q=80&w=1974&auto=format&fit=crop', true, 5, NOW(), NOW());