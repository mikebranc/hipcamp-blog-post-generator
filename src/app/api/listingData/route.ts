import * as cheerio from 'cheerio';
import { NextRequest, NextResponse } from 'next/server';
import { ListingDataResonse } from '@/app/types';


  type ListingDataParams = {
    urls: string[];
    waitTime?: number;
  };


export async function POST(req: NextRequest, res: NextResponse<ListingDataResonse[]>) {
    try {
        const data: ListingDataParams = await req.json()
        const urls: string[] = data.urls; // Expecting a list of URLs in the request body
        const waitTime: number = data.waitTime || 1; // Optional wait time between requests
        const results: ListingDataResonse[] = [];
    
        for (const url of urls) {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to fetch ${url}: status ${response.status}`);
            const html = await response.text();
            const $ = cheerio.load(html);
    
            const title = $('h1[class*="Title__TitleText"]').text();
            const description = $('span[class*="Description__TruncatableHTML"]').text();
    
            results.push({ title, description, url });
    
            // Respect the wait time between requests
            await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
        }
    
        return NextResponse.json(results, { status: 200 });
      } catch (error) {
        NextResponse.json({ error: 'Failed to scrape the data' }, { status: 500 });
      }
  }