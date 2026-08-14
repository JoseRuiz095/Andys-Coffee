export interface Product {
  id: string
  name: string
  description: string
  price: number
  image: string
  available: number
  category: string
}

export const allProducts: Product[] = [
  // Bebidas
  { id: '1', name: 'Espresso', description: 'Café solo, intenso y aromático.', price: 35.00, image: 'https://images.unsplash.com/photo-1579929336849-e6a4a8f3dd7e?q=80&w=1974&auto=format&fit=crop', available: 20, category: 'Bebidas' },
  { id: '2', name: 'Latte regular', description: 'Espresso con leche vaporizada y una fina capa de espuma.', price: 45.00, image: 'https://images.unsplash.com/photo-1561882468-91101f2dfc7b?q=80&w=2127&auto=format&fit=crop', available: 15, category: 'Bebidas' },
  { id: '3', name: 'Latte Vainilla', description: 'Latte endulzado con jarabe de vainilla.', price: 50.00, image: 'https://images.unsplash.com/photo-1599399125932-651a462435c9?q=80&w=1974&auto=format&fit=crop', available: 15, category: 'Bebidas' },
  { id: '4', name: 'Latte Caramel Macciato', description: 'Espresso, leche vaporizada, vainilla y un toque de caramelo.', price: 55.00, image: 'https://images.unsplash.com/photo-1576092762791-d62c15f3b2ca?q=80&w=1974&auto=format&fit=crop', available: 12, category: 'Bebidas' },
  { id: '5', name: 'Latte Moka', description: 'La combinación perfecta de espresso, chocolate y leche.', price: 55.00, image: 'https://images.unsplash.com/photo-1607260550779-7b7iginal.jpg?q=80&w=1974&auto=format&fit=crop', available: 12, category: 'Bebidas' },
  { id: '6', name: 'Latte Biscoff', description: 'Un delicioso latte con el sabor único de la galleta Biscoff.', price: 60.00, image: 'https://plus.unsplash.com/premium_photo-1675435633349-5a5e4a1d8b32?q=80&w=1974&auto=format&fit=crop', available: 10, category: 'Bebidas' },
  { id: '7', name: 'Latte Andy\'s', description: 'La especialidad de la casa, un secreto delicioso.', price: 65.00, image: 'https://images.unsplash.com/photo-1517701559498-006c54958d55?q=80&w=1964&auto=format&fit=crop', available: 10, category: 'Bebidas' },
  { id: '8', name: 'Americano', description: 'Espresso diluido con agua caliente, suave pero con carácter.', price: 35.00, image: 'https://images.unsplash.com/photo-1559496417-e7f40064c782?q=80&w=1974&auto=format&fit=crop', available: 20, category: 'Bebidas' },
  { id: '9', name: 'Latte regular Frio', description: 'Nuestro clásico latte, pero refrescante y con hielo.', price: 48.00, image: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?q=80&w=2069&auto=format&fit=crop', available: 15, category: 'Bebidas' },
  { id: '10', name: 'Latte Vainilla Frio', description: 'La dulzura de la vainilla en un latte helado.', price: 53.00, image: 'https://images.unsplash.com/photo-1553909489-cd47e0907910?q=80&w=1974&auto=format&fit=crop', available: 15, category: 'Bebidas' },
  { id: '11', name: 'Latte Caramel Macciato Frio', description: 'La versión helada de nuestro popular Caramel Macchiato.', price: 58.00, image: 'https://images.unsplash.com/photo-1594212699903-c82ab5d88349?q=80&w=1974&auto=format&fit=crop', available: 12, category: 'Bebidas' },
  { id: '12', name: 'Latte Biscoff Frio', description: 'Galleta Biscoff y café en una bebida fría irresistible.', price: 63.00, image: 'https://images.unsplash.com/photo-1610890435899-a5135a415a78?q=80&w=1974&auto=format&fit=crop', available: 10, category: 'Bebidas' },
  { id: '13', name: 'Latte Moka Frio', description: 'Chocolate y café en una refrescante bebida helada.', price: 58.00, image: 'https://images.unsplash.com/photo-1525088553748-01d6e210604d?q=80&w=1974&auto=format&fit=crop', available: 12, category: 'Bebidas' },
  { id: '14', name: 'Latte Andy\'s Frio', description: 'Nuestra especialidad secreta, ahora en versión fría.', price: 68.00, image: 'https://images.unsplash.com/photo-1592201131135-f655a85537a2?q=80&w=1974&auto=format&fit=crop', available: 10, category: 'Bebidas' },
  { id: '15', name: 'Americano Iced', description: 'Un americano clásico servido con hielo.', price: 38.00, image: 'https://images.unsplash.com/photo-1517701559498-006c54958d55?q=80&w=1964&auto=format&fit=crop', available: 20, category: 'Bebidas' },
  { id: '16', name: 'Coffee Cream', description: 'Bebida cremosa de café, suave y deliciosa.', price: 60.00, image: 'https://images.unsplash.com/photo-1507133750040-4a8f570215de?q=80&w=1974&auto=format&fit=crop', available: 10, category: 'Bebidas' },
  { id: '17', name: 'Chai vainilla frio', description: 'Té chai con un toque de vainilla, servido frío.', price: 55.00, image: 'https://images.unsplash.com/photo-1595842793394-b342a19e4a40?q=80&w=1974&auto=format&fit=crop', available: 15, category: 'Bebidas' },
  { id: '18', name: 'Chai vainilla', description: 'Té chai especiado con leche y un toque de vainilla.', price: 52.00, image: 'https://images.unsplash.com/photo-1578899695329-9698d2a33a8b?q=80&w=1974&auto=format&fit=crop', available: 15, category: 'Bebidas' },
  { id: '19', name: 'Chai guayaba frío', description: 'Una exótica combinación de té chai y guayaba, servida fría.', price: 55.00, image: 'https://images.unsplash.com/photo-1623013343435-a3a2a65a35f5?q=80&w=1974&auto=format&fit=crop', available: 10, category: 'Bebidas' },
  { id: '20', name: 'Chai guayaba', description: 'Té chai caliente con el sabor tropical de la guayaba.', price: 52.00, image: 'https://images.unsplash.com/photo-1622027242903-8ddd79b44f4e?q=80&w=1974&auto=format&fit=crop', available: 10, category: 'Bebidas' },
  { id: '41', name: 'Limonada', description: 'Refrescante limonada natural.', price: 40.00, image: 'https://images.unsplash.com/photo-1600093966784-48c9e43a4a75?q=80&w=1974&auto=format&fit=crop', available: 20, category: 'Bebidas' },
  { id: '42', name: 'Bloom', description: 'Bebida floral y refrescante, especialidad de la casa.', price: 50.00, image: 'https://images.unsplash.com/photo-1621442493101-bf4c45a73849?q=80&w=1974&auto=format&fit=crop', available: 15, category: 'Bebidas' },
  { id: '43', name: 'Refresher Limon-Fresa', description: 'Bebida refrescante con limón y fresa.', price: 55.00, image: 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a7?q=80&w=1974&auto=format&fit=crop', available: 15, category: 'Bebidas' },
  // Bagels
  { id: '21', name: 'Bagel campirano', description: 'Bagel con ingredientes frescos del campo.', price: 75.00, image: 'https://images.unsplash.com/photo-1598679253351-d3a610d3e1e2?q=80&w=1974&auto=format&fit=crop', available: 10, category: 'Bagels' },
  { id: '22', name: 'Bagel de pollo', description: 'Delicioso bagel relleno de pollo marinado.', price: 85.00, image: 'https://images.unsplash.com/photo-1625194659729-51b9952497f6?q=80&w=1974&auto=format&fit=crop', available: 8, category: 'Bagels' },
  { id: '23', name: 'Bagel americano', description: 'El clásico bagel con huevo, tocino y queso.', price: 80.00, image: 'https://images.unsplash.com/photo-1551843426-d4772a8a73d3?q=80&w=1974&auto=format&fit=crop', available: 10, category: 'Bagels' },
  { id: '24', name: 'Bagel carnivoro', description: 'Para los amantes de la carne, con una mezcla de carnes frías.', price: 90.00, image: 'https://images.unsplash.com/photo-1607013251379-e6eecfffe234?q=80&w=1974&auto=format&fit=crop', available: 7, category: 'Bagels' },
  { id: '40', name: 'Mini bagel philadelphia', description: 'Pequeño bagel con queso crema Philadelphia.', price: 45.00, image: 'https://images.unsplash.com/photo-1628834997028-9a8d29a5a73c?q=80&w=1974&auto=format&fit=crop', available: 15, category: 'Bagels' },
  // Desayunos
  { id: '25', name: 'Chilaquiles naturales rojos', description: 'Totopos bañados en salsa roja, con crema y queso.', price: 90.00, image: 'https://images.unsplash.com/photo-1605696192993-994b884a8f3c?q=80&w=1974&auto=format&fit=crop', available: 10, category: 'Desayunos' },
  { id: '26', name: 'Chilaquiles naturales verdes', description: 'Totopos bañados en salsa verde, con crema y queso.', price: 90.00, image: 'https://images.unsplash.com/photo-1605696192993-994b884a8f3c?q=80&w=1974&auto=format&fit=crop', available: 10, category: 'Desayunos' },
  { id: '27', name: 'Chilaquiles pollo rojos', description: 'Chilaquiles rojos con pollo deshebrado.', price: 110.00, image: 'https://images.unsplash.com/photo-1605696192993-994b884a8f3c?q=80&w=1974&auto=format&fit=crop', available: 8, category: 'Desayunos' },
  { id: '28', name: 'Chilaquiles pollo verdes', description: 'Chilaquiles verdes con pollo deshebrado.', price: 110.00, image: 'https://images.unsplash.com/photo-1605696192993-994b884a8f3c?q=80&w=1974&auto=format&fit=crop', available: 8, category: 'Desayunos' },
  { id: '29', name: 'Chilaquiles huevo rojos', description: 'Chilaquiles rojos acompañados de huevo estrellado o revuelto.', price: 105.00, image: 'https://images.unsplash.com/photo-1605696192993-994b884a8f3c?q=80&w=1974&auto=format&fit=crop', available: 8, category: 'Desayunos' },
  { id: '30', name: 'Chilaquiles huevo verdes', description: 'Chilaquiles verdes acompañados de huevo estrellado o revuelto.', price: 105.00, image: 'https://images.unsplash.com/photo-1605696192993-994b884a8f3c?q=80&w=1974&auto=format&fit=crop', available: 8, category: 'Desayunos' },
  { id: '31', name: 'Chilaquiles arrachera rojos', description: 'Chilaquiles rojos con jugosa arrachera.', price: 140.00, image: 'https://images.unsplash.com/photo-1605696192993-994b884a8f3c?q=80&w=1974&auto=format&fit=crop', available: 6, category: 'Desayunos' },
  { id: '32', name: 'Chilaquiles arrachera verdes', description: 'Chilaquiles verdes con jugosa arrachera.', price: 140.00, image: 'https://images.unsplash.com/photo-1605696192993-994b884a8f3c?q=80&w=1974&auto=format&fit=crop', available: 6, category: 'Desayunos' },
  { id: '33', name: 'Canadiense', description: 'Desayuno completo estilo canadiense.', price: 120.00, image: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?q=80&w=2080&auto=format&fit=crop', available: 10, category: 'Desayunos' },
  { id: '34', name: 'Viajero', description: 'Un desayuno práctico y delicioso para llevar.', price: 95.00, image: 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?q=80&w=1910&auto=format&fit=crop', available: 12, category: 'Desayunos' },
  { id: '35', name: 'Duo continental', description: 'Desayuno ligero con pan, mermelada y café.', price: 85.00, image: 'https://images.unsplash.com/photo-1490004803954-2597430dd5a3?q=80&w=2070&auto=format&fit=crop', available: 15, category: 'Desayunos' },
  // Promociones
  { id: '36', name: 'Promo Latte Andy´s 2x1', description: 'Disfruta de dos Lattes Andy\'s al precio de uno.', price: 65.00, image: 'https://images.unsplash.com/photo-1517701559498-006c54958d55?q=80&w=1964&auto=format&fit=crop', available: 50, category: 'Promociones' },
  { id: '37', name: 'Promo BomDia', description: 'Café americano y croissant por un precio especial.', price: 60.00, image: 'https://images.unsplash.com/photo-1555949182-b8972353b149?q=80&w=2070&auto=format&fit=crop', available: 30, category: 'Promociones' },
  { id: '38', name: '4to desayuno gratis (Viajero)', description: 'Acumula 3 desayunos Viajero y el 4to es gratis.', price: 0.00, image: 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?q=80&w=1910&auto=format&fit=crop', available: 100, category: 'Promociones' },
  { id: '39', name: 'Promo mochilero', description: 'Bagel americano y refresco a precio de paquete.', price: 95.00, image: 'https://images.unsplash.com/photo-1551843426-d4772a8a73d3?q=80&w=1974&auto=format&fit=crop', available: 20, category: 'Promociones' },
  { id: '44', name: 'Promo limonadas', description: 'Dos limonadas por un precio especial.', price: 70.00, image: 'https://images.unsplash.com/photo-1600093966784-48c9e43a4a75?q=80&w=1974&auto=format&fit=crop', available: 40, category: 'Promociones' },
]