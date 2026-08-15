import { createClient } from '@supabase/supabase-js';

// Vercel Cron hits this route on the schedule set in vercel.json (weekdays
// at 9pm UTC by default — adjust to taste). When CRON_SECRET is set on the
// Vercel project, Vercel automatically sends it as
// `Authorization: Bearer <CRON_SECRET>` on cron-triggered requests, which is
// what the check below verifies. This also lets you trigger a manual refresh
// by calling the URL yourself with that same header.
//
// Uses the Supabase service_role key (server-only) so it can write updated
// prices without a logged-in browser session — RLS is bypassed for this key.
export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return Response.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not set' }, { status: 500 });
  }
  if (!process.env.FINNHUB_API_KEY) {
    return Response.json({ error: 'FINNHUB_API_KEY is not set' }, { status: 500 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: holdings, error } = await supabase.from('holdings').select('id, ticker');
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const tickers = [...new Set((holdings || []).map(h => (h.ticker || '').trim().toUpperCase()).filter(Boolean))];
  const results = [];

  for (const ticker of tickers) {
    try {
      const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ticker)}&token=${process.env.FINNHUB_API_KEY}`);
      const json = await res.json();
      const price = json?.c;
      if (typeof price === 'number' && price > 0) {
        const { error: updErr } = await supabase.from('holdings').update({ current_price: price }).ilike('ticker', ticker);
        results.push({ ticker, price, updated: !updErr, error: updErr?.message });
      } else {
        results.push({ ticker, error: 'No price returned from Finnhub' });
      }
    } catch (err) {
      results.push({ ticker, error: err.message || String(err) });
    }
  }

  return Response.json({ tickers: tickers.length, results });
}
