# Facebook Messenger
curl -X POST https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Messages.json \
--data-urlencode 'To=messenger:3699899563446901' \
--data-urlencode 'From=messenger:103859605404977' \
--data-urlencode 'Body=Hello from Twilio Facebook Channel' \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN 


# WhatsApp
curl -X POST https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Messages.json \
--data-urlencode 'To=whatsapp:+12063996576' \
--data-urlencode 'From=whatsapp:+14155238886' \
--data-urlencode 'Body=Hello from Twilio WhatsApp Channel' \
-u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN

# To join the sandbox mobile user must send a WhatsApp message to +1 415 523 8886 with code 'join population-trouble'

# Pre-approved outgoing templates for WhatsApp
Your {{1}} code is {{2}}
Your {{1}} appointment is coming up on {{2}}
Your {{1}} order of {{2}} has shipped and should be delivered on {{3}}. Details : {{4}}