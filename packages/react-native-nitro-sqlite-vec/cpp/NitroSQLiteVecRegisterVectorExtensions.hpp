#pragma once

namespace margelo::rnnitrosqlitevec {

/** Register the statically linked sqlite-vec initializer as a SQLite auto-extension.
 * A process-wide once flag makes repeated calls safe before each database open.
 */
void registerVectorExtensions();

} // namespace margelo::rnnitrosqlitevec
