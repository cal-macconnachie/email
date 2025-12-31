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
    const phoneNumber = event.request.userAttributes.phone_number

    if (!phoneNumber) {
      console.warn('No phone_number attribute found for user')
      return event
    }

    console.log('Trigger version:', event.version)
    console.log('Phone number:', phoneNumber)

    // V2 trigger: Add claims to both access token and ID token
    if (event.version === '2') {
      event.response = {
        claimsAndScopeOverrideDetails: {
          accessTokenGeneration: {
            claimsToAddOrOverride: {
              phone_number: phoneNumber,
            },
          },
          idTokenGeneration: {
            claimsToAddOrOverride: {
              phone_number: phoneNumber,
            },
          },
        },
      }
      console.log('Added phone_number to V2 tokens:', phoneNumber)
    } else {
      // V1 trigger: Only adds to ID token (legacy behavior)
      event.response = {
        claimsOverrideDetails: {
          claimsToAddOrOverride: {
            phone_number: phoneNumber,
          },
        },
      }
      console.log('Added phone_number to V1 ID token only:', phoneNumber)
    }

    return event
  } catch (error) {
    console.error('Error in pre-token generation:', error)
    // Return event unchanged on error to avoid blocking token generation
    return event
  }
}
