# Self-Driving Car (No Libraries)

**[▶ Live demo](https://stiekex.github.io/self-driving-car/)**: runs in your browser, nothing to install.

A simulation where cars learn to drive through traffic using a neural network and a
genetic algorithm, written in plain JavaScript and the HTML canvas, with no frameworks
and no ML libraries.

Each car "sees" the road with 5 ray sensors. A small neural network turns those readings
into steering and throttle. 100 cars drive at once, the best brain is kept, and the next
generation starts from mutated copies of it. The project also measures how well this
works, compares it with a hand-written driver, and reports where it fails.

![Self-driving car demo: 100 AI cars on a 3-lane road, with the best car's sensors and neural network shown live](demo.gif)

## Try it

| Link | What you see |
|---|---|
| [Default](https://stiekex.github.io/self-driving-car/) | 100 cars, starting from a brain trained offline, on the training layout |
| [Random traffic](https://stiekex.github.io/self-driving-car/?traffic=random) | a new, unseen traffic layout every generation |
| [Rule-based driver](https://stiekex.github.io/self-driving-car/?mode=rule&traffic=random) | the hand-written baseline driver |
| [Drive yourself](https://stiekex.github.io/self-driving-car/?mode=keys) | one car, arrow keys |

**Buttons**

| Button | What it does |
|---|---|
| Save | save the best car's brain now |
| Next gen | keep the best brain and start the next generation |
| Auto-train | start the next generation automatically when the current one ends |
| Speed | 1, 10 or 50 simulation steps per frame |
| Load trained | start again from the brain trained offline |
| Discard | forget the saved brain and start from random brains |

The panel at the top left shows the generation, cars alive, how many traffic cars the
best car overtook, and a bar chart of the best result per generation.

## How it works

```
sensors (5 rays) --> neural network --> controls --> car physics --> collision check
       ^                                                                  |
       +-------------------------- next frame ----------------------------+
```

| Part | What it does |
|---|---|
| Car physics | acceleration, friction, max speed, reverse, steering |
| Collision | each car is a 4-point polygon, damaged when an edge crosses a road border or a traffic car (segment intersection) |
| Sensors | 5 rays over 90°, 150 px long, each returning the distance to the nearest border or traffic car as 0 (nothing) to 1 (touching) |
| Neural network | feed-forward, 5 → 6 → 4, sigmoid activation; outputs = forward / reverse / left / right, an output above 0.5 presses that key |
| Training | neuroevolution (a simple genetic algorithm, no backpropagation): car 0 keeps the parent brain unchanged, 99 cars get copies where each weight and bias moves 10% towards a random value |
| Fitness | **traffic cars overtaken while undamaged**, with distance only as a tie-breaker |
| Traffic | 6 rows of slower cars; each row blocks 1-2 of the 3 lanes; a fixed layout for training, or seeded random layouts |
| Visualizer | the best car's network, live: yellow = positive weight, blue = negative, stronger colour = larger value |

### Why the fitness counts overtakes

The first version ranked cars by distance alone, and training got stuck: a car that stays
behind a traffic car never crashes, so it always looked like the "best" car, and every
generation learned to tailgate instead of overtake. Counting overtakes first fixes that.

## Results

All numbers come from `node tools/evaluate.js 100` (reproducible, see below).
Each cell shows **traffic overtaken (mean) / runs that cleared all traffic / runs that crashed**.
"Random layouts" are 100 layouts (seeds 1-100) that no driver was trained or tuned on.

| Driver | Training layout | 100 unseen random layouts |
|---|---|---|
| Untrained network (random weights) | 0% / 0% / 32% | 1% / 0% / 33% |
| Hand-written rule driver (`baseline.js`) | 100% / 100% / 0% | 100% / 100% / 0% |
| Trained network (`pretrained.js`) | 100% / 100% / 0% | 42% / 14% / 30% |

**What this shows:**

- **Training works on the road it trains on.** From random brains, the network learned to
  overtake all 10 traffic cars on the training layout.
- **It does not generalise.** On unseen layouts it clears only 14% and crashes in 30%:
  it memorised the training road rather than learning to drive in general.
- **A 5-rule driver beats it** on unseen roads. With this simple genetic algorithm,
  the learned driver is not better than a hand-written one.

**Other experiments**

- **Training is unreliable.** With 60 generations on the training layout, 2 of 5 random
  seeds learned to clear all traffic; the others got stuck at 3-5 of 10.
  The shipped brain is from one of the successful runs (seed 3).
- **Mutation strength.** Moving each weight 10% (the setting used) cleared the layout in
  2/5 seeds, against 1/5 for 30% and 1/5 for a 2-50% mix.
- **Training on random traffic did not fix generalisation.** With a new random layout every
  generation (100 generations, 3 seeds), the brains overtook only 16% of unseen traffic.
  Each brain is judged on a single layout, so a car that was lucky on an easy road becomes
  the parent; selection is too noisy.
- **The baseline needed care too.** Its first version steered right, then left, then
  right... when both sides looked equal, wobbling behind traffic forever. Committing to
  one side unless the other is clearly emptier fixed it. Its thresholds were tuned on
  separate layouts (seeds 1001-1100), and the result stays at 100% across a range of
  settings, so it is not tuned to one lucky value.

## Run it locally

Open `index.html` in a browser. If saving does not persist between refreshes,
serve the folder instead (for example with the VS Code **Live Server** extension).

### Training and evaluation (Node.js 18+)

The same simulation code runs without a browser:

```bash
node tools/train.js 60 3 fixed      # 60 generations, seed 3, fixed layout -> pretrained.js
node tools/train.js 100 1 random    # train on a new random layout every generation
node tools/evaluate.js 100          # results table on the training layout + 100 unseen layouts
```

The same seed always produces the same brain and the same results.

## Project structure

| File | Purpose |
|---|---|
| `index.html`, `style.css` | page layout: stats panel, road canvas, buttons, network canvas |
| `main.js` | generations, fitness, auto-train, save/load (validated), stats and chart, animation loop |
| `car.js` | physics, collision polygon, damage check, sensor → brain → controls |
| `sensor.js` | ray casting and readings |
| `network.js` | `NeuralNetwork` and `Level`: feed-forward and mutation |
| `traffic.js` | fixed and random traffic layouts, overtake counting |
| `baseline.js` | hand-written rule driver used as the baseline |
| `pretrained.js` | brain trained offline (generated by `tools/train.js`) |
| `visualizer.js` | draws the network |
| `controls.js`, `road.js`, `utils.js` | keyboard / AI controls, road, maths helpers |
| `tools/` | headless training (`train.js`) and evaluation (`evaluate.js`) |

## Limitations and next steps

- **No generalisation yet.** The next step is to score each brain on several random layouts
  per generation instead of one, so lucky runs stop being selected.
- **Small brain, simple algorithm.** 5 rays and a 5-6-4 network, mutation only
  (no crossover between two good brains).
- **Simplified world.** Straight road, traffic that never changes lanes, top-down 2D physics.
- Saved brains live in your browser only (localStorage).

## Credits

Based on Radu Mariescu-Istodor's *Self-Driving Car – No Libraries* JavaScript course.
The fitness function, traffic generator, baseline, auto-training, offline training and
evaluation tools, and the experiments above were added on top of the course project.
