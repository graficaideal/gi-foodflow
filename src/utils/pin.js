import bcrypt from 'bcryptjs'

export const pinFormatoOk = pin => /^\d{4}$/.test(pin)

// Regras do PIN escolhido pelo funcionário. null = válido; senão a mensagem a mostrar.
export const erroNovoPin = (pin, numero) => {
  if (!pinFormatoOk(pin))                                       return 'O PIN tem de ter 4 dígitos.'
  if (/^(\d)\1{3}$/.test(pin))                                  return 'O PIN não pode ter os 4 dígitos iguais.'
  if ('0123456789'.includes(pin) || '9876543210'.includes(pin)) return 'O PIN não pode ser uma sequência.'
  if (pin === String(numero).trim().padStart(4, '0'))           return 'O PIN não pode ser igual ao número de funcionário.'
  return null
}

// ponytail: bcryptjs 3 só gera $2b$ e o pgcrypto só reconhece $2a$; para PINs curtos o algoritmo é o mesmo.
export const hashPin = async pin => (await bcrypt.hash(pin, 10)).replace(/^\$2b\$/, '$2a$')
