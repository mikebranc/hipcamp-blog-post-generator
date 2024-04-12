import OpenAI from 'openai';
import { OpenAIStream, StreamingTextResponse } from 'ai';
import { createParser } from 'eventsource-parser'

// Create an OpenAI API client (that's edge friendly!)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
 
// Set the runtime to edge for best performance
export const runtime = 'edge';
export const dynamic = 'force-dynamic';
 
export async function POST(req: Request) {
  const { messages } = await req.json();
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  const readableStream = new ReadableStream({
      async start(controller) {
      const parser = createParser((event) => {
          if (event.type === 'event') {
              if (event.data === '[DONE]') {
                  controller.close()
              } else {
                  const data = JSON.parse(event.data)
                  controller.enqueue(encoder.encode(data.choices[0].delta.content))
              }
          }
      })

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo-1106',
            messages: messages,
            stream: true,
            temperature: 0,
          }),
      })

      if (!response.ok || response.body === null) {
        console.log('Response error:', response.status, await response.text());
        throw new Error('Failed to get a valid response');
      }

      if (response.body) {
        const reader = response.body.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            parser.feed(decoder.decode(value));
          }
        } catch (error) {
          console.error('Error reading the stream:', error);
          throw error;
        } finally {
          reader.releaseLock();
        }
      }
    },
  })

  return new Response(readableStream)
}