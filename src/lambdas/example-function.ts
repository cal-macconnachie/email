import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda'

export const handler = async (
    event: APIGatewayProxyEvent,
    context: Context
): Promise<APIGatewayProxyResult> => {
    console.log('Event received:', JSON.stringify(event, null, 2));
    console.log('Context:', JSON.stringify(context, null, 2));

    const response: APIGatewayProxyResult = {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: 'Hello from Lambda!',
            timestamp: new Date().toISOString(),
            environment: process.env.ENVIRONMENT,
            region: process.env.REGION,
            functionName: context.functionName,
            requestId: context.awsRequestId,
        }),
    };

    return response;
};
