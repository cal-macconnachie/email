provider "aws" {
  region = var.aws_region
}

# Dynamo DB Table for tracking sent and received emails
resource "aws_dynamodb_table" "email_tracking" {
  name         = "${var.domain_name}-emails"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "recipient"
  range_key    = "timestamp"

  # Enable DynamoDB Streams for push notifications
  stream_enabled   = true
  stream_view_type = "NEW_IMAGE"

  attribute {
    name = "recipient"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  attribute {
    name = "recipient_sender"
    type = "S"
  }

  global_secondary_index {
    name            = "RecipientSenderIndex"
    hash_key        = "recipient_sender"
    range_key       = "timestamp"
    projection_type = "ALL"
  }

  tags = {
    Name        = "${var.domain_name}-email-tracking-table"
    Environment = var.environment
  }
}

# DynamoDB Table for email threading
resource "aws_dynamodb_table" "thread_relations" {
  name         = "${var.domain_name}-thread-relations"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "thread_id"
  range_key    = "timestamp"

  attribute {
    name = "thread_id"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  attribute {
    name = "message_id"
    type = "S"
  }

  attribute {
    name = "recipient"
    type = "S"
  }

  global_secondary_index {
    name            = "MessageIdIndex"
    hash_key        = "message_id"
    range_key       = "recipient"
    projection_type = "ALL"
  }

  tags = {
    Name        = "${var.domain_name}-thread-relations-table"
    Environment = var.environment
  }
}

# DynamoDB Table for phone-email mapping (authentication)
resource "aws_dynamodb_table" "phone_email_relations" {
  name         = "${var.domain_name}-phone-email-relations"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "phone_number"

  attribute {
    name = "phone_number"
    type = "S"
  }

  attribute {
    name = "email_prefix"
    type = "S"
  }

  # GSI for reverse lookup: email_prefix -> phone_number
  global_secondary_index {
    name            = "EmailPrefixIndex"
    hash_key        = "email_prefix"
    projection_type = "ALL"
  }

  tags = {
    Name        = "${var.domain_name}-phone-email-relations-table"
    Environment = var.environment
  }
}

# DynamoDB Table for push notification subscriptions
resource "aws_dynamodb_table" "push_subscriptions" {
  name         = "${var.domain_name}-push-subscriptions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "phone_number"
  range_key    = "subscription_id"

  attribute {
    name = "phone_number"
    type = "S"
  }

  attribute {
    name = "subscription_id"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  # GSI for querying active subscriptions efficiently
  global_secondary_index {
    name            = "StatusIndex"
    hash_key        = "phone_number"
    range_key       = "status"
    projection_type = "ALL"
  }

  tags = {
    Name        = "${var.domain_name}-push-subscriptions-table"
    Environment = var.environment
  }
}
