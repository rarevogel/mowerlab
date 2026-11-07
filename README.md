# Mower Lab

A robot-mower simulator for a tablet (or a browser). Draw your own lawn with obstacles, place the charging station, set the mower up, write rule-based algorithms, and see which one mows your garden fastest.

## What you can do
- **Garden:** draw lawn shapes and rectangles (several shapes merge into one lawn), flower beds, ponds, paving and hedges, and round trees. Place the charging station and choose which way the mower faces when it's docked. Drag points to reshape, tap the small + to add a point, and snap to a grid. Four example gardens are included.
- **Mower:**
  - cutting width and chassis width (the cutting disc can't reach right up to an edge);
  - speed and turning speed;
  - mowing time per charge and charging time;
  - how far it backs out of the station;
  - whether it keeps cutting on the way home;
  - **wobble**: bumps in the ground and small steering differences bend every straight track slightly, a little differently each time;
  - **turning inaccuracy**: a random error on every turn. Compass turns ("turn to a direction") are four times more accurate, so lanes stay parallel.
- **Algorithms:** rules for four events.
  - Events: leaving the station, reaching the lawn edge, bumping into an obstacle, and every N minutes.
  - Steps: back up, drive forward (in metres or cutting widths), turn by a fixed angle or a random angle in a range (clockwise, counter-clockwise, random or alternating), turn to a direction, turn to a random direction, spiral outwards, follow the edge, and wait.
  - Going home: the battery level at which it heads home, and the way home (shortest path like a GPS/RTK mower, or along the boundary wire). It also leaves earlier when the charge is only just enough to get home.
- **Simulate:** watch it mow at 1× to 5000×, or jump to the end. You can show the path, a heat map of how often each spot was cut, and the spots the mower can't reach.
- **Compare:** race several algorithms on the same garden, with several random seeds averaged. You get a coverage-over-time chart and a table: time to 50/75/90/95/99%, distance driven, charges, average passes and bumps per hour.

## How the simulation works
- The garden is rasterised to 5 cm cells.
- Exact Euclidean distance transforms give, for every cell, the distance to the lawn edge and to the nearest obstacle. The mower's centre may only go where both distances are at least half the chassis width.
- A bump is reported as "edge" or "obstacle" according to which limit was hit first.
- Every move marks the cells under the cutting disc; coverage only counts lawn cells.
- A flood fill from the station finds what the mower can reach at all. Coverage is shown against that maximum, as well as against the whole lawn.
- A shortest-path distance field from the station drives the mower home when it returns by "shortest path".
- Each step is 0.05 s of simulated time. Wobble is a slowly drifting curvature (a mean-reverting random walk), and every new track starts with its own small curve. All randomness comes from a seeded generator, so a run can be repeated exactly, while different seeds give different paths.

## Build
```sh
python3 build.py                 # dist/mowerlab.html — the whole app in one file
cd android
KEYSTORE_FILE=/path/MowerLab.jks KEY_ALIAS=mowerlab KEYSTORE_PASSWORD=... ./build.sh
```
- The app needs no permissions and works offline.
- Package `nl.rarevogel.mowerlab`, minSdk 24, targetSdk 35.
- Keep the keystore out of the repo.

## Credits
Charts: [Chart.js](https://www.chartjs.org/) 4.4.7 (MIT, `web/lib/LICENSE-chartjs.txt`). Everything else is drawn in code.
