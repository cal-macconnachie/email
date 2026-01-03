import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { getAuthenticatedRecipient } from './middleware/auth-middleware'

export const checkSession = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Authenticate and get recipient from phone→email mapping
    const authResult = await getAuthenticatedRecipient(event)
    if (!authResult.success) {
      return {
        statusCode: authResult.statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: authResult.error }),
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Session is valid',
        phone_number: authResult.phoneNumber,
        recipients: authResult.recipients,
        default_recipient: authResult.defaultRecipient,
      }),
    }
  } catch (error) {
    console.error('Error in checkSession handler:', error)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    }
  }
}
