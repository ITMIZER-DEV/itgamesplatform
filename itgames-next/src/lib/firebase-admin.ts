import * as admin from 'firebase-admin'
import { prisma } from './prisma'

const firebaseApps: { [tenant_id: number]: admin.app.App } = {}

export async function getFirebaseApp(tenant_id: number): Promise<admin.app.App | null> {
  if (firebaseApps[tenant_id]) {
    return firebaseApps[tenant_id]
  }

  // Verificar se já existe uma instância do aplicativo para o tenantId no admin global
  const appName = `tenantApp-${tenant_id}`
  const existingApp = admin.apps.find((app) => app?.name === appName)
  if (existingApp) {
    firebaseApps[tenant_id] = existingApp as admin.app.App
    return existingApp as admin.app.App
  }

  const firebaseConfig = await prisma.firebaseConfig.findUnique({
    where: { organization_id: tenant_id },
  })

  if (!firebaseConfig) {
    return null
  }

  const app = admin.initializeApp(
    {
      credential: admin.credential.cert({
        projectId: firebaseConfig.project_id,
        clientEmail: firebaseConfig.client_email,
        privateKey: firebaseConfig.private_key,
      }),
    },
    appName
  )

  firebaseApps[tenant_id] = app
  return app
}

export async function updateFirebaseUser(tenant_id: number, uuid: string, data: { name?: string, email?: string, cpf?: string, phoneNumber?: string }) {
  const app = await getFirebaseApp(tenant_id)
  if (!app || !uuid) return

  try {
    if (data.name || data.email) {
      await app.auth().updateUser(uuid, {
        displayName: data.name,
        email: data.email,
      })
    }

    const customClaims: any = {}
    if (data.cpf) customClaims.cpf = data.cpf
    if (data.phoneNumber) customClaims.phoneNumber = data.phoneNumber

    if (Object.keys(customClaims).length > 0) {
      await app.auth().setCustomUserClaims(uuid, customClaims)
    }
  } catch (error) {
    console.error(`Erro ao atualizar usuário no Firebase (Tenant ${tenant_id}):`, error)
  }
}
