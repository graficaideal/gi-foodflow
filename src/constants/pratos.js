// Cor do prato depende da posição (slot 1–4), nunca do texto da label.
const SLOTS = ['carne', 'peixe', 'dieta', 'veg']
export const pratoSlotKey = n => SLOTS[(n - 1) % SLOTS.length]   // n = 1..4
export const pratoColors = n => {
  const k = pratoSlotKey(n)
  return { fg: `var(--prato-${k}-fg)`, bg: `var(--prato-${k}-bg)`, bd: `var(--prato-${k}-bd)` }
}
export const PRATO_GLYPHS = ['flame', 'fish', 'salad', 'leaf']   // ícone por slot, tal como a cor
// Slot 4 é o único cuja label varia por dia; nova ementa usa o primeiro valor
export const SLOT4_LABELS = ['Vegetariano', 'Opção']
