import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'

const ssmClient = new SSMClient({ region: process.env.REGION || 'us-east-1' })

export interface VapidKeys {
  publicKey: string
  privateKey: string
  subject: string
}

/**
 * Load VAPID keys from AWS SSM Parameter Store
 *
 * VAPID keys are automatically generated and stored by the GitHub Actions
 * workflow on first deployment. This function loads them for push notifications.
 *
 * The private key is stored as a SecureString for encryption at rest.
 *
 * Environment variables required:
 * - VAPID_PUBLIC_KEY_PARAM: SSM parameter name for public key
 * - VAPID_PRIVATE_KEY_PARAM: SSM parameter name for private key
 * - VAPID_SUBJECT_PARAM: SSM parameter name for subject (mailto URL)
 */
export async function getVapidKeys(): Promise<VapidKeys> {
  const publicKeyParam = process.env.VAPID_PUBLIC_KEY_PARAM
  const privateKeyParam = process.env.VAPID_PRIVATE_KEY_PARAM
  const subjectParam = process.env.VAPID_SUBJECT_PARAM

  if (!publicKeyParam || !privateKeyParam || !subjectParam) {
    throw new Error(
      'Missing VAPID key parameter names. Required: VAPID_PUBLIC_KEY_PARAM, VAPID_PRIVATE_KEY_PARAM, VAPID_SUBJECT_PARAM'
    )
  }

  try {
    // Fetch all three parameters in parallel
    const [publicKeyResponse, privateKeyResponse, subjectResponse] = await Promise.all([
      ssmClient.send(
        new GetParameterCommand({
          Name: publicKeyParam,
          WithDecryption: false, // Public key is not encrypted
        })
      ),
      ssmClient.send(
        new GetParameterCommand({
          Name: privateKeyParam,
          WithDecryption: true, // Private key is SecureString - decrypt it
        })
      ),
      ssmClient.send(
        new GetParameterCommand({
          Name: subjectParam,
          WithDecryption: false,
        })
      ),
    ])

    const publicKey = publicKeyResponse.Parameter?.Value
    const privateKey = privateKeyResponse.Parameter?.Value
    const subject = subjectResponse.Parameter?.Value

    if (!publicKey || !privateKey || !subject) {
      throw new Error('One or more VAPID parameters have no value')
    }

    return {
      publicKey,
      privateKey,
      subject,
    }
  } catch (error) {
    console.error('Failed to load VAPID keys from SSM:', error)
    throw new Error(`Failed to load VAPID keys: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
