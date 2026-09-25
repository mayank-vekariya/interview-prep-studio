window.FOUNDATIONS = [
{id:'js-foundations',title:'JavaScript you can explain while coding',track:'node',minutes:35,priority:'core',summary:'Scope, closures, reference values, Map and Set, and the language choices that make interview code clear.',sections:[
{title:'Start with values, references, and scope',html:`<p>JavaScript has primitive values such as strings, numbers, booleans, undefined and null. Objects and arrays are reference values: two variables can point to the same object. <code>const</code> prevents rebinding the variable; it does not freeze the object. Prefer <code>const</code> until reassignment is necessary, then use <code>let</code>. Both are block scoped. <code>var</code> is function scoped and can make loop and callback behavior surprising.</p><pre><code>const original = { tags: ['comedy'] };
const shallow = { ...original };
shallow.tags.push('drama');
// original.tags also contains 'drama'.
// The outer object was copied; the nested array was shared.
const independent = { ...original, tags: [...original.tags] };</code></pre><p>Use <code>===</code> for comparisons without implicit type conversion. <code>undefined</code> commonly means absent or not assigned; <code>null</code> is an explicit empty value. Use <code>??</code> for a fallback only when a value is null or undefined; <code>||</code> also replaces valid values such as 0, false, or an empty string.</p><p>Destructuring names fields directly: <code>const { id, title } = movie</code>. Spread copies enumerable properties into a new object. Neither is validation: a request body still needs a runtime schema or explicit checks.</p>`},
{title:'Functions and closures',html:`<p>A function packages a calculation or behavior. A pure function returns the same result for the same inputs without changing shared state. Small pure helpers are easy to test. A closure is a function retaining access to variables in its lexical scope after the outer function has returned.</p><pre><code>function makeCounter() {
  let count = 0;
  return () => ++count;
}
const a = makeCounter();
const b = makeCounter();
a(); // 1
a(); // 2
b(); // 1 — a separate closure
</code></pre><p>This is useful for encapsulation, callbacks and factories. It also explains a React stale closure: a callback can retain values from the render where it was created. Arrow functions capture the surrounding <code>this</code>; ordinary methods receive <code>this</code> based on how they are called. Do not rely on a detached method retaining its receiver.</p><p>A debounce waits until calls stop for a chosen interval. A throttle limits execution frequency. Debouncing a search input can reduce requests, but cancel or ignore old responses too: fewer requests alone do not prevent a stale response from replacing new results.</p>`},
{title:'Choose the right collection',html:`<p>Use an array for ordered values, a Set for membership and uniqueness, and a Map for keys mapped to values. Map accepts keys of any type and preserves insertion order. Objects are useful for records with known named fields. A Map is convenient for dynamic counters and avoids collisions with inherited property names.</p><pre><code>const counts = new Map();
for (const genre of ['comedy', 'drama', 'comedy']) {
  counts.set(genre, (counts.get(genre) ?? 0) + 1);
}
const seen = new Set(['comedy', 'drama']);
seen.has('comedy'); // true
// Numeric sort needs a comparator:
const sorted = [10, 2, 1].sort((a, b) => a - b);</code></pre><p>In algorithm discussions we usually assume expected O(1) Map and Set operations. JavaScript requires average sublinear access, not a particular hash-table implementation. State the interview assumption rather than promising constant time in every case. An array's <code>includes</code> scans O(n), so using it inside a loop can produce O(n²) work.</p><p><code>map</code> transforms values, <code>filter</code> selects them, and <code>reduce</code> accumulates a result. A clear loop is often easier to explain than a dense reduce expression. Never use <code>forEach(async ...)</code> when you need to await completion of all operations.</p>`},
{title:'TypeScript and a clean coding routine',html:`<p>TypeScript checks types before execution; its types are erased at runtime. A type assertion does not prove that JSON from a client has the right shape. Validate the boundary, then use explicit internal types. Prefer <code>unknown</code> to <code>any</code> for untrusted values, narrow it, and model possible failures.</p><p>Before coding, restate the inputs and desired output, ask about duplicates and mutation, and walk through one example. Explain a simple baseline, identify its bottleneck, then choose the data structure. Name the invariant your loop maintains. After coding, trace the example and test empty, smallest, repeated and boundary inputs. Finish with time and auxiliary-space complexity.</p><blockquote>“I will use a Map because I repeatedly need to look up a previously seen value. Before processing position i, the map contains only positions before i. That prevents me from reusing the same element.”</blockquote>`}
],checks:['Explain const with a mutable object.','Write a closure without looking.','Choose Map, Set or array and explain why.','Explain why TypeScript does not validate request JSON.'],questions:[{q:'What does a spread copy actually copy?',a:'It creates a new outer object or array and copies its immediate entries. Nested objects remain shared references unless explicitly copied.'},{q:'Why can await inside forEach surprise you?',a:'forEach ignores returned promises. Use for...of for sequential work or await Promise.all(items.map(...)) for a small, already-bounded set of independent operations. Use a worker pool for large inputs.'}]},
{id:'node-async',title:'Node.js, the event loop, and async work',track:'node',minutes:40,priority:'core',summary:'Understand what runs where, choose concurrent or sequential work, and keep requests responsive.',sections:[
{title:'How one thread serves many requests',html:`<p>A typical Node.js process executes JavaScript callbacks on one main thread. When code starts asynchronous I/O, it can return control instead of waiting. Network I/O is commonly handled through the operating system; some filesystem, crypto and DNS operations use libuv's worker pool. When work is ready, Node schedules the continuation. Concurrent requests can make progress without executing all JavaScript simultaneously.</p><pre><code>request → start I/O → return control
other request → start I/O → return control
I/O ready → callback / promise continuation → response</code></pre><p>This works well for I/O-heavy APIs. It does not make CPU-heavy JavaScript free. A large synchronous JSON parse, expensive loop, pathological regular expression or synchronous filesystem call can delay every request using that loop. Bound inputs; profile first; use worker threads or a separate worker service for substantial CPU work. Increasing the worker-pool size does not move arbitrary JavaScript loops off the main thread.</p><p>Watch event-loop delay, request p95 latency, CPU, dependency latency and pool saturation together. High API latency with low database latency can point toward blocked execution, but measure before choosing a fix.</p>`},
{title:'Promises are eventual results',html:`<p>A Promise represents an eventual value or rejection. <code>async</code> functions always return promises. <code>await</code> pauses that async function and lets the runtime run other work; it does not block the entire event loop. Wrap awaited work in try/catch when this layer can recover or translate the error. Otherwise let a centralized handler respond.</p><pre><code>async function loadPage(id) {
  const [movie, reviews] = await Promise.all([
    getMovie(id),
    getReviews(id)
  ]);
  return { movie, reviews };
}</code></pre><p>Independent requests can overlap: two operations taking 100 ms and 150 ms may finish in roughly 150 ms plus overhead, instead of approximately 250 ms. Sequential awaits are correct when B needs A's result. <code>Promise.all</code> rejects when one input rejects, but does not cancel the other operations. Use <code>Promise.allSettled</code> when partial results are useful, and inspect every result.</p><p>Do not start 100,000 requests at once. A promise combinator does not impose a concurrency limit. Use a small worker pool or queue, deadlines and dependency-specific limits. Retry transient failures with bounded backoff and jitter; retry only when repeating the operation is safe.</p>`},
{title:'Predict output, with context',html:`<pre><code>// A normal Node CommonJS script, at top level:
console.log('A');
setTimeout(() => console.log('timer'), 0);
Promise.resolve().then(() => console.log('promise'));
console.log('B');
// A, B, promise, timer</code></pre><p>The synchronous stack completes first. Promise handlers run as microtasks before the timer callback in this example. A zero-delay timer is eligible later; it is not an instruction to run immediately. Avoid memorizing a universal ordering of every timer, I/O callback and <code>setImmediate</code>: execution context and Node behavior matter. Recursive microtasks or nextTick callbacks can also starve I/O.</p><blockquote>“Single-threaded describes the usual JavaScript execution path. Node still relies on the operating system and worker facilities for concurrency. I keep callbacks small so other requests can make progress.”</blockquote>`},
{title:'Timeouts, cleanup, and failures',html:`<pre><code>async function fetchMovie(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(3000)
  });
  if (!response.ok) {
    throw new Error('Upstream status ' + response.status);
  }
  return response.json();
}</code></pre><p>This illustrative helper bounds a fetch with a timeout and checks HTTP status: fetch does not reject simply because a server returns 404 or 500. In a real API, accept only configured upstream hosts, validate response shape and size, and log a safe request identifier. A client disconnect or timeout does not automatically undo work already committed upstream.</p><p>Use finally to release a resource that this function acquired. Graceful shutdown should stop taking new requests, allow a bounded drain and close owned connections. Keep fatal process-level errors distinct from expected validation or dependency errors.</p>`}
],checks:['Explain I/O concurrency without saying all work happens on one thread.','Predict the small ordering example.','Explain Promise.all rejection and cancellation separately.','Describe a CPU-bound task and where to run it.'],questions:[{q:'Does async make a CPU loop non-blocking?',a:'No. Synchronous code inside an async function still executes on the current JavaScript thread until it yields or returns. Move substantial CPU work to an appropriate worker.'},{q:'Should every failed request be retried?',a:'No. A validation error will not improve, and a timed-out write may already have committed. Use a bounded policy for transient failures and idempotency for repeatable writes.'}]},
{id:'api-database',title:'APIs, SQL, and reliable backend code',track:'node',minutes:45,priority:'core',summary:'Design a small API, protect its boundaries, reason about indexes and transactions, and explain your performance work.',sections:[
{title:'Build the request path in layers',html:`<p>A useful request path is authentication → authorization → validation → business logic → persistence → response. Authentication identifies the caller; authorization decides whether that caller may access this specific resource. Never trust a body field such as userId as proof of ownership. Keep HTTP concerns near the controller and domain rules in a service that can be tested without a real HTTP request.</p><pre><code>// Express 5 illustrative route; dependencies are application-owned.
app.get('/movies/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id &lt;= 0) {
    return res.status(400).json({ error: 'Invalid movie id' });
  }
  const movie = await movies.findById(id);
  if (!movie) return res.status(404).json({ error: 'Not found' });
  res.json({ data: movie });
});
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  logError(error); // redact secrets and personal data
  res.status(500).json({ error: 'Request failed' });
});</code></pre><p>In Express 5, rejected returned promises from handlers are forwarded automatically to error middleware. Older Express 4 handlers need explicit forwarding or a wrapper. Error middleware has four parameters and comes after routes. Validate request shape, enforce body limits, parameterize SQL, bound pagination and apply rate limits where necessary.</p>`},
{title:'HTTP and data contracts',html:`<p>GET reads, POST usually creates or performs an action, PUT replaces a resource at a known identity, PATCH applies a partial change, and DELETE removes it. GET should not make requested business-state changes. HTTP idempotency means repeating an operation has the same intended effect; it does not require an identical response each time. POST can gain application-level idempotency through a request key and a durable result record.</p><ul><li>Use 200 for a successful read, 201 for a newly created resource, 204 for a success without a response body.</li><li>Use 400 for invalid input, 401 for missing/invalid credentials, 403 for denied access, 404 for missing resources and 409 for a state conflict.</li><li>Return a consistent error shape with a safe code and request identifier. Do not expose stack traces.</li><li>Use cursor pagination for changing feeds. A stable order such as created_at plus id avoids ambiguous ties.</li></ul><p>A watchlist API could expose <code>PUT /me/watchlist/:movieId</code> and <code>DELETE /me/watchlist/:movieId</code>. A unique database constraint on (user_id, movie_id) makes repeated additions safe. The server derives user_id from the authenticated identity.</p>`},
{title:'Indexes and the 40% performance claim',html:`<p>An index is an additional data structure that can make a lookup, join or ordering cheaper. It consumes space and adds write work. Start from an actual slow query and representative data. Use a query plan to see scans, joins, sorts, row estimates and work performed; do not add indexes to every column by habit.</p><pre><code>SELECT id, created_at
FROM orders
WHERE tenant_id = $1 AND status = $2
ORDER BY created_at DESC, id DESC
LIMIT 50;
-- Candidate, subject to plan and workload measurement:
CREATE INDEX orders_tenant_status_created
ON orders (tenant_id, status, created_at DESC, id DESC);</code></pre><p>The query and index share leading equality filters and the ordering. Low selectivity, stale statistics or different queries may change the benefit. N+1 queries, unnecessary columns and unbounded results can matter more than a missing index.</p><p>For the resume's “40%” claim, prepare the exact metric, before/after values, dataset, test conditions, measurement method, and your personal contribution. If query time fell from 100 ms to 60 ms, that is a 40% reduction in that measured latency. These numbers are an illustration, not a claim about your project. Do not substitute throughput or overall application speed for the actual metric.</p>`},
{title:'Transactions protect invariants',html:`<p>A transaction groups database changes so they commit together or roll back. An invariant is a rule that must always hold: inventory cannot become negative, a ledger entry cannot be posted twice, or a watchlist relation must be unique. A read-then-write check outside a transaction is vulnerable to concurrent requests.</p><pre><code>UPDATE inventory
SET quantity = quantity - $1
WHERE sku = $2 AND quantity &gt;= $1;
-- Require quantity requested &gt; 0, and exactly one affected row.
-- Record the order/ledger change in the same transaction.</code></pre><p>Use constraints, conditional updates, appropriate locking or optimistic versions. If a transaction succeeds but publishing its event fails, the transactional outbox pattern stores an event alongside the change; a worker later publishes it and consumers tolerate duplicates. An idempotency key needs an atomic unique claim, not two separate “check then insert” calls.</p><p>To debug an API, reproduce a specific failing request, follow its request ID through logs, measure its dependencies, and add a regression check around the real invariant. A good test proves that concurrent purchases cannot oversell or repeated payment requests cannot create duplicate effects; it does more than repeat the code's implementation.</p>`}
],checks:['Draw the request path including authorization.','Explain an index using a real query.','Describe how you measured your resume performance claim.','Explain why check-then-write can race.'],questions:[{q:'Where should retry safety live?',a:'At the business operation boundary and persistence layer, using durable idempotency records or unique constraints tied to the transaction. A UI disabled button is not sufficient.'},{q:'What is the difference between authentication and authorization?',a:'Authentication establishes identity. Authorization checks whether that identity is allowed to perform this action on this resource, including tenant and object ownership.'}]},
{id:'react-refresh',title:'React: the useful interview refresh',track:'react',minutes:25,priority:'supporting',summary:'Props, state, effects, stable keys, controlled inputs, and handling requests that finish out of order.',sections:[
{title:'Render from state',html:`<p>A component describes UI from props and state. Props are inputs from its parent; state is remembered information owned by the component. A state update schedules rendering; it does not rewrite the current render's variables. Treat objects and arrays in state as immutable: create a changed copy. When the next state depends on the previous one, use a functional update such as <code>setCount(c =&gt; c + 1)</code>.</p><p>A controlled input receives its value from state and reports edits through onChange. Keep state close to where it is used, lift it when siblings must coordinate, and use Context for shared values where prop passing becomes awkward. Context does not automatically make updates cheap.</p><p>For a list, use a stable identifier as the key. An array position can attach the wrong component state to an item after insertion or reordering. Keys need to be unique among siblings; changing a key intentionally resets that component's identity.</p>`},
{title:'Effects synchronize with external systems',html:`<p>An Effect is for synchronization with something outside React, such as a subscription, timer or network request. Compute derived values during render when possible. Handle a user action in its event handler rather than indirectly through an Effect. Declare every reactive dependency used by the Effect, and clean up the work from the previous run.</p><pre><code>// Illustrative component fragment:
useEffect(() => {
  const controller = new AbortController();
  let active = true;
  setLoading(true);
  setError(null);
  fetch('/api/movies?q=' + encodeURIComponent(query), {
    signal: controller.signal
  })
    .then(r => {
      if (!r.ok) throw new Error('Could not load movies');
      return r.json();
    })
    .then(data => { if (active) setMovies(data); })
    .catch(e => {
      if (active &amp;&amp; e.name !== 'AbortError') setError(e.message);
    })
    .finally(() => { if (active) setLoading(false); });
  return () => { active = false; controller.abort(); };
}, [query]);</code></pre><p>If the user types “space” and then “space comedy”, the earlier response may arrive last. The active flag prevents the old result from replacing the current one; abort attempts to cancel obsolete work. In a production framework, use its data-fetching facilities or a suitable cache when available. This fragment teaches the race and cleanup directly.</p><p>No dependency array means the Effect runs after each commit. An empty array means it has no reactive dependencies, not “absolutely once in all situations”: development Strict Mode adds an extra setup/cleanup cycle, and remounting starts it again.</p>`},
{title:'Refs, memoization, and a small debugging exercise',html:`<p><code>useRef</code> keeps a mutable value across renders without causing a render when changed. Use it for a DOM element or timer handle, not for visible state. <code>useMemo</code> caches a calculation and <code>useCallback</code> caches a function identity according to dependencies. They are performance tools, not fixes for incorrect effects or stale data. Measure before adding them everywhere.</p><p>Exercise: a search component fetches on every render. First inspect whether its Effect has missing or unstable dependencies. Then check whether the Effect updates a dependency itself. Move pure derived calculations out of the Effect, stabilize the actual inputs when necessary, and make cleanup correct. Do not merely delete dependencies to silence the loop.</p><blockquote>“I design loading, empty, error and success states. I keep request results tied to the current query so old requests cannot overwrite new results. Then I measure whether caching or memoization helps.”</blockquote>`}
],checks:['Explain props versus state.','Describe an out-of-order fetch bug and its fix.','Explain why a stable list key matters.','Name one appropriate useRef use.'],questions:[{q:'Why does an Effect run twice in development?',a:'Strict Mode intentionally performs an extra setup/cleanup cycle to reveal missing cleanup. Make the effect safe to start and stop; do not rely on suppressing the check.'},{q:'Should filtered items be put in another state variable?',a:'Usually derive filtered items from the source state and filter during rendering. Separate state duplicates information and can fall out of sync.'}]}
];
