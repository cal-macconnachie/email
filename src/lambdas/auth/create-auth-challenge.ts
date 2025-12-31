import { PublishCommand, SNSClient } from '@aws-sdk/client-sns'
import { CreateAuthChallengeTriggerEvent, CreateAuthChallengeTriggerHandler } from 'aws-lambda'
import { randomInt } from 'crypto'

const snsClient = new SNSClient({ region: process.env.REGION })

/**
 * Cognito Lambda Trigger: Create Auth Challenge
 *
 * Generates a 6-digit OTP code and sends it via SMS.
 * The code is stored in privateChallengeParameters (encrypted, not visible to client).
 */
export const handler: CreateAuthChallengeTriggerHandler = async (
  event: CreateAuthChallengeTriggerEvent
) => {
  console.log('CreateAuthChallenge event:', JSON.stringify(event, null, 2))

  const { request, response } = event

  // Generate 6-digit OTP
  const otpCode = randomInt(100000, 999999).toString()
  const phoneNumber = request.userAttributes.phone_number

  console.log(`Generated OTP for ${phoneNumber}: ${otpCode}`)

  // Store OTP in private parameters (encrypted, not sent to client)
  response.privateChallengeParameters = {
    otpCode,
  }

  // Public parameters sent to client (masked hint)
  response.publicChallengeParameters = {
    phoneNumber: maskPhoneNumber(phoneNumber),
  }

  // Challenge metadata
  response.challengeMetadata = 'OTP_CHALLENGE'

  // Send SMS via SNS
  try {
    await snsClient.send(
      new PublishCommand({
        PhoneNumber: phoneNumber,
        Message: `Your verification code is: ${otpCode}\n\nThis code expires in 5 minutes.`,
        MessageAttributes: {
          'AWS.SNS.SMS.SMSType': {
            DataType: 'String',
            StringValue: 'Transactional',
          },
        },
      })
    )

    console.log(`SMS sent successfully to ${phoneNumber}`)
  } catch (error) {
    console.error('Error sending SMS:', error)
    throw new Error('Failed to send OTP SMS')
  }

  console.log('CreateAuthChallenge response:', JSON.stringify(response, null, 2))
  return event
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
