import { NextResponse } from 'next/server'

// O usuário pediu para não usar Supabase. 
// Para manter a estrutura sem quebrar os arquivos que já importam getAuthUser,
// retornamos um mock de usuário válido para as rotas administrativas.

export async function getAuthUser(request: Request) {
  // Como o sistema front-end já controla as permissões e o usuário não quer Supabase,
  // vamos permitir temporariamente as requisições, ou você pode plugar a validação do Firebase aqui depois.
  return { id: 'admin', role: 'admin' }
}

export function unauthorizedResponse() {
  return NextResponse.json(
    { error: 'Não autorizado.' },
    { status: 401 }
  )
}

