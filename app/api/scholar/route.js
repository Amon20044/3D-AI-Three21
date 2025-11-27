import { NextResponse } from 'next/server';
import { searchGoogleScholar } from '@/lib/apifyClient';

export async function POST(request) {
    try {
        const body = await request.json();
        const {
            query,
            maxItems,
            includeCitations,
            minYear,
            maxYear,
            country,
            language,
            languageResults,
            patentsCourts,
            sortBy
        } = body;

        if (!query) {
            return NextResponse.json(
                { error: 'Query parameter is required' },
                { status: 400 }
            );
        }

        const results = await searchGoogleScholar({
            query,
            maxItems: maxItems || 10,
            includeCitations: includeCitations !== undefined ? includeCitations : true,
            minYear,
            maxYear,
            country,
            language,
            languageResults,
            patentsCourts,
            sortBy
        });

        return NextResponse.json({ success: true, data: results });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch data from Google Scholar', details: error.message },
            { status: 500 }
        );
    }
}
