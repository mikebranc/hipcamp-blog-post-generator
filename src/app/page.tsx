'use client';
import { FormEvent, useState, ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';

// Update markdown output to cast codeblocks as text and add fomatting for links
const markdownComponents = {
  // Customize how links are rendered
  a: ({node, ...props}: {node: any, href?: string, children?: ReactNode}) => (
      <a style={{ color: 'blue', textDecoration: 'underline' }} {...props} />
  ),
  // Customize how code is rendered
  code({node, inline, className, children, ...props}: {node: any, inline?: boolean, className?: string, children?: ReactNode}) {
      if (inline) {
          return <span {...props}>{children}</span>; // Inline code as plain text
      } else {
          return <div {...props}>{children}</div>; // Code blocks as plain text
      }
  }
};


type ListingDataResponse = {
  title: string;
  description: string;
  url: string;
};

export default function Home() {
  const [urls, setUrls] = useState<string>('');
  const [results, setResults] = useState<ListingDataResponse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [responseText, setResponseText] = useState<string>('');

  const fetchListingData = async (urls: string[]): Promise<ListingDataResponse[]> => {
    try {
      const response = await fetch('/api/listingData', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      });
      if (!response.ok) throw new Error('Failed to fetch listing data');
      return response.json();
    } catch (error) {
      console.error('Error fetching listing data:', error);
      throw error; // Rethrow to handle in calling function
    }
  };

  const streamOpenAIResponse = async (listings: ListingDataResponse[]) => {
    const listingsString = listings.map(listing => 
      `Title: ${listing.title}, Description: ${listing.description}, URL: ${listing.url}`
    ).join("\n");

    const messages = [
      { role: "system", content: "You are a helpful marketing assistant that works for hipcamp as a copywriter and SEO expert. Please draft a blog post that describes the best HipCamps in the Madison,WI area. You will get a list of listings with the listing description, the name of the listing and a url. Please take this info to create a blog post. Your blog post should help our SEO and also should really highlight each property. Be sure to include the url for each property. Your response MUST BE in markdown format" },
      { role: "user", content: listingsString }
    ];

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break; // Exit loop if stream is complete
        const chunk = decoder.decode(value);
        setResponseText(prevText => prevText + chunk);
      }
    } catch (error) {
      console.error('Error streaming OpenAI response:', error);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setResults([]);
    setResponseText('');

    try {
      const urlsArray = urls.split('\n').filter(Boolean); // Split by newline and filter out empty strings
      const listings = await fetchListingData(urlsArray);
      setResults(listings);
      await streamOpenAIResponse(listings);
    } catch (error) {
      alert('Failed to process listings');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 min-h-screen">
      <form onSubmit={handleSubmit} className="space-y-4">
        <textarea
          className="w-full p-2 border rounded"
          rows={4}
          placeholder="Enter URLs, one per line..."
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
        />
        <button
          type="submit"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : 'Submit URLs'}
        </button>
      </form>
      <div className="results mt-4">
        {results.length > 0 && (
          <p>Results fetched</p>
          // <div className="results mt-4">
          //   {results.map((result, index) => (
          //     <div key={index} className="mb-4 p-4 border rounded">
          //       <h3 className="font-bold">Title: {result.title}</h3>
          //       <p>Description: {result.description}</p>
          //       <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
          //         Visit
          //       </a>
          //     </div>
          //   ))}
          // </div>
        )}
        {responseText && (
          <div className="response mt-4 p-4 border rounded">
            <h3 className="font-bold">OpenAI Response:</h3>
            <ReactMarkdown 
              components={{
                  a: ({ node, ...props }) => <a style={{ color: 'blue', textDecoration: 'underline' }} {...props} />
              }}
            >
              {responseText}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
