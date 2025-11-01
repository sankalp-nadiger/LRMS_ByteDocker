import { NextApiRequest, NextApiResponse } from 'next';
import twilio from 'twilio';
import { supabase } from '@/lib/supabase';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_WHATSAPP_PHONE;

const client = twilio(accountSid, authToken);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, message, landRecordId } = req.body;

  if (!to || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Format phone number for WhatsApp
    const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    const formattedFrom = `whatsapp:${twilioPhone}`;

    // Send WhatsApp message
    const twilioMessage = await client.messages.create({
      body: message,
      from: formattedFrom,
      to: formattedTo
    });

    // Log the message in broker_messages table
    const { data, error } = await supabase
  .from('broker_messages')
  .insert([{
    land_record_id: landRecordId,
    broker_id: req.body.brokerId, // Add broker ID
    user_email: req.body.userEmail,
    message: message,
    phone_number: to,
    status: 'sent',
    twilio_message_id: twilioMessage.sid,
    sent_at: new Date().toISOString()
  }])
  .select()
  .single();
    if (error) {
      console.error('Error logging broker message:', error);
    }

    res.status(200).json({ 
      success: true, 
      messageId: twilioMessage.sid,
      status: twilioMessage.status 
    });
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    
    // Log failed attempt
    await supabase
      .from('broker_messages')
      .insert([{
        land_record_id: landRecordId,
        user_email: req.body.userEmail,
        message: message,
        phone_number: to,
        status: 'failed',
        error_message: error.message
      }]);

    res.status(500).json({ error: 'Failed to send WhatsApp message' });
  }
}