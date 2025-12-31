import { PreTokenGenerationTriggerEvent, Context } from 'aws-lambda'

/**
 * Pre Token Generation Lambda Trigger
 *
 * Adds custom claims to Cognito tokens before they're issued.
 * This allows us to include phone_number in the access token
 * so the authorizer doesn't need to look it up on every request.
 */
export const handler = async (
  event: PreTokenGenerationTriggerEvent,
  _context: Context
): Promise<PreTokenGenerationTriggerEvent> => {
  await Promise.resolve() // for linting async function without await
  console.log('Pre-token generation event:', JSON.stringify(event, null, 2))

  try {
    // Add phone_number to access token claims
    if (event.request.userAttributes.phone_number) {
      event.response = {
        claimsOverrideDetails: {
          claimsToAddOrOverride: {
            phone_number: event.request.userAttributes.phone_number,
          },
        },
      }

      console.log(
        'Added phone_number to token:',
        event.request.userAttributes.phone_number
      )
    } else {
      console.warn('No phone_number attribute found for user')
    }

    return event
  } catch (error) {
    console.error('Error in pre-token generation:', error)
    // Return event unchanged on error to avoid blocking token generation
    return event
  }
}
