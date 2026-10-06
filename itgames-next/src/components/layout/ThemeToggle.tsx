'use client'
import { Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/contexts/ThemeContext'

export function ThemeToggle() {
  const { theme, toggle } = useTheme()

  return (
    <Button variant="ghost" size="icon" onClick={toggle} title={theme === 'dark' ? 'Mudar para claro' : 'Mudar para escuro'}>
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}
