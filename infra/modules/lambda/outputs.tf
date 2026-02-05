output "slack_handler_function_name" {
  description = "Name of the Slack handler Lambda function"
  value       = aws_lambda_function.slack_handler.function_name
}

output "slack_handler_invoke_arn" {
  description = "Invoke ARN of the Slack handler Lambda function"
  value       = aws_lambda_function.slack_handler.invoke_arn
}

output "tick_handler_function_name" {
  description = "Name of the tick handler Lambda function"
  value       = aws_lambda_function.tick_handler.function_name
}

output "tick_handler_arn" {
  description = "ARN of the tick handler Lambda function"
  value       = aws_lambda_function.tick_handler.arn
}
