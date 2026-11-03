import { useState, useEffect } from 'react'
import { hoje } from '../utils/date'

// Dia real do sistema. Intervalo: quiosque aberto a passar a meia-noite. Focus/visibilitychange: janela reaberta ou máquina a acordar.
export default function useHoje() {
  const [today, setToday] = useState(hoje)
  useEffect(() => {
    const sync = () => setToday(hoje())
    const id = setInterval(sync, 30000)
    window.addEventListener('focus', sync)
    document.addEventListener('visibilitychange', sync)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', sync)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [])
  return today
}
