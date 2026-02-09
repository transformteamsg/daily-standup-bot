resource "aws_cloudwatch_event_rule" "tick" {
  name                = "${var.project_name}-tick-rule"
  description         = "Triggers tick handler every minute"
  schedule_expression = "rate(1 minute)"

  tags = var.tags
}

resource "aws_cloudwatch_event_target" "tick" {
  rule = aws_cloudwatch_event_rule.tick.name
  arn  = var.tick_handler_arn
}

resource "aws_lambda_permission" "eventbridge" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = var.tick_handler_function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.tick.arn
}
