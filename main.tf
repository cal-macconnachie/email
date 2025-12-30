provider "aws" {
  region = var.aws_region
}

# Dynamo DB Table for tracking sent and received emails
resource "aws_dynamodb_table" "email_tracking" {
  name         = "${var.domain_name}-emails"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "recipient"
  range_key    = "timestamp"

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
