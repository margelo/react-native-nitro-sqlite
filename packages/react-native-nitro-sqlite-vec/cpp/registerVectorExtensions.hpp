#pragma once

namespace margelo::rnnitrosqlitevec {

// Idempotent; safe to call on every database open.
void registerVectorExtensions();

} // namespace margelo::rnnitrosqlitevec
