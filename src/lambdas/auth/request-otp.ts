import {
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminInitiateAuthCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider'
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda'

const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.REGION })

interface RequestOtpRequest {
  phone_number: string
}

/**
 * Initiate SMS OTP authentication flow
 *
 * This Lambda receives a phone number, ensures the user exists in Cognito,
 * and initiates the custom auth flow which triggers OTP generation and SMS sending.
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Request OTP event:', JSON.stringify(event, null, 2))

    // Parse request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Request body is required' }),
      }
    }

    const { phone_number } = JSON.parse(event.body) as RequestOtpRequest

    // Validate phone number
    if (!phone_number) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'phone_number is required' }),
      }
    }

    // Validate E.164 format (e.g., +15551234567)
    if (!isValidE164PhoneNumber(phone_number)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Invalid phone number format. Use E.164 format (e.g., +15551234567)'
        }),
      }
    }

    const userPoolId = process.env.COGNITO_USER_POOL_ID
    const clientId = process.env.COGNITO_CLIENT_ID

    if (!userPoolId || !clientId) {
      throw new Error('Cognito configuration missing')
    }

    // Check if user exists, create if not
    await ensureUserExists(userPoolId, phone_number)

    // Initiate custom auth flow (triggers OTP generation)
    const authResponse = await cognitoClient.send(
      new AdminInitiateAuthCommand({
        UserPoolId: userPoolId,
        ClientId: clientId,
        AuthFlow: 'CUSTOM_AUTH',
        AuthParameters: {
          USERNAME: phone_number,
        },
      })
    )

    const session = authResponse.Session

    if (!session) {
      throw new Error('Failed to initiate auth session')
    }

    console.log(`OTP sent successfully to ${phone_number}`)

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session,
        message: `OTP sent to ${maskPhoneNumber(phone_number)}`,
      }),
    }
  } catch (error) {
    console.error('Error requesting OTP:', error)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to send OTP',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    }
  }
}

/**
 * Ensure user exists in Cognito User Pool, create if not
 */
async function ensureUserExists(userPoolId: string, phoneNumber: string): Promise<void> {
  try {
    // Try to get user
    await cognitoClient.send(
      new AdminGetUserCommand({
        UserPoolId: userPoolId,
        Username: phoneNumber,
      })
    )
    console.log(`User ${phoneNumber} already exists`)
  } catch (error: unknown) {
    if ((error as Error).name === 'UserNotFoundException') {
      // Create user
      console.log(`Creating new user: ${phoneNumber}`)
      await cognitoClient.send(
        new AdminCreateUserCommand({
          UserPoolId: userPoolId,
          Username: phoneNumber,
          UserAttributes: [
            {
              Name: 'phone_number',
              Value: phoneNumber,
            },
            {
              Name: 'phone_number_verified',
              Value: 'true',
            },
          ],
          MessageAction: 'SUPPRESS', // Don't send welcome email
        })
      )
      console.log(`User ${phoneNumber} created successfully`)
    } else {
      throw error
    }
  }
}

/**
 * Validate E.164 phone number format
 */
function isValidE164PhoneNumber(phoneNumber: string): boolean {
  // E.164: + followed by 1-15 digits
  const e164Regex = /^\+[1-9]\d{1,14}$/
  return e164Regex.test(phoneNumber)
}

/**
 * Mask phone number for display (e.g., +15551234567 → +1555***4567)
 */
function maskPhoneNumber(phoneNumber: string): string {
  if (phoneNumber.length < 7) {
    return phoneNumber
  }

  const start = phoneNumber.slice(0, -4)
  const end = phoneNumber.slice(-4)
  const masked = start.replace(/\d/g, '*').slice(0, start.length - 3) + start.slice(-3)

  return masked + end
}
