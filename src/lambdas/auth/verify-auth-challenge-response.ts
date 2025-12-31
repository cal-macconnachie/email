import { VerifyAuthChallengeResponseTriggerEvent, VerifyAuthChallengeResponseTriggerHandler } from 'aws-lambda'

/**
 * Cognito Lambda Trigger: Verify Auth Challenge Response
 *
 * Validates the user's OTP answer against the expected code.
 */
export const handler: VerifyAuthChallengeResponseTriggerHandler = async (
  event: VerifyAuthChallengeResponseTriggerEvent
) => {
  await new Promise((resolve) => setTimeout(resolve, 10)) // Simulate async work
  console.log('VerifyAuthChallengeResponse event:', JSON.stringify(event, null, 2))

  const { request, response } = event

  // Get expected OTP from private challenge parameters
  const expectedAnswer = request.privateChallengeParameters?.otpCode
  const userAnswer = request.challengeAnswer

  console.log(`Expected OTP: ${expectedAnswer}, User provided: ${userAnswer}`)

  // Compare OTP codes (exact match)
  if (expectedAnswer && userAnswer && expectedAnswer === userAnswer) {
    response.answerCorrect = true
    console.log('OTP verification: SUCCESS')
  } else {
    response.answerCorrect = false
    console.log('OTP verification: FAILED')
  }

  console.log('VerifyAuthChallengeResponse response:', JSON.stringify(response, null, 2))
  return event
}
