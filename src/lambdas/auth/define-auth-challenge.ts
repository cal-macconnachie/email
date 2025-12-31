import { DefineAuthChallengeTriggerEvent, DefineAuthChallengeTriggerHandler } from 'aws-lambda'

/**
 * Cognito Lambda Trigger: Define Auth Challenge
 *
 * Orchestrates the custom authentication flow for SMS OTP.
 *
 * Flow:
 * - Session 1: User initiates auth → Issue CUSTOM_CHALLENGE (OTP required)
 * - Session 2: User provides OTP → If correct, issue tokens; if incorrect, fail
 */
export const handler: DefineAuthChallengeTriggerHandler = async (
  event: DefineAuthChallengeTriggerEvent
) => {
  await new Promise((resolve) => setTimeout(resolve, 10)) // Simulate async work
  console.log('DefineAuthChallenge event:', JSON.stringify(event, null, 2))

  const { request, response } = event

  // Session 1: User just started auth - issue custom challenge (OTP)
  if (request.session.length === 0) {
    response.challengeName = 'CUSTOM_CHALLENGE'
    response.issueTokens = false
    response.failAuthentication = false
    console.log('Session 1: Issuing CUSTOM_CHALLENGE (OTP required)')
  }
  // Session 2+: User answered challenge
  else if (request.session.length > 0) {
    const lastSession = request.session[request.session.length - 1]

    // If last challenge was answered correctly
    if (lastSession.challengeResult === true) {
      response.issueTokens = true
      response.failAuthentication = false
      console.log('Session 2: Challenge answered correctly - issuing tokens')
    }
    // If last challenge was answered incorrectly
    else {
      // Allow up to 3 attempts
      if (request.session.length >= 3) {
        response.issueTokens = false
        response.failAuthentication = true
        console.log('Session 2+: Max attempts exceeded - failing authentication')
      } else {
        // Issue another challenge
        response.challengeName = 'CUSTOM_CHALLENGE'
        response.issueTokens = false
        response.failAuthentication = false
        console.log(`Session ${request.session.length + 1}: Challenge failed - issuing another attempt`)
      }
    }
  }

  console.log('DefineAuthChallenge response:', JSON.stringify(response, null, 2))
  return event
}
