import 'dotenv/config';
import { SarvamAIClient } from 'sarvamai';

const apiKey = process.env.SARVAM_API_KEY;

if (!apiKey) {
  console.error('Error: SARVAM_API_KEY is not set in environment or .env');
  process.exit(1);
}

const client = new SarvamAIClient({
  apiSubscriptionKey: apiKey,
});

async function main() {
  console.log('Connecting to Sarvam AI...');
  const response = await client.chat.completions({
    model: 'sarvam-105b-conversations',
    messages: [
      {
        role: 'user',
        content: 'Hello from Awaz-e-Shikayat verification! Please respond with a brief greeting in Hindi and English.',
      },
    ],
  });

  const reply = response.choices?.[0]?.message?.content;
  console.log('\n--- Sarvam AI Chat Completion Response ---');
  console.log(reply);
  console.log('-------------------------------------------\n');
  console.log('Verification SUCCESSFUL!');
}

main().catch((err) => {
  console.error('Verification FAILED:', err.message || err);
  process.exit(1);
});
