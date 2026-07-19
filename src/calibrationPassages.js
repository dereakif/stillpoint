export const CALIBRATION_PASSAGES = [
  {
    id: 'garden-shed-key',
    version: 1,
    text: `On Saturday morning, Maya arrived early at the community garden to prepare for the spring planting day. The paths were still damp from overnight rain, but the sky had cleared. She unlocked the tool shed, set clean gloves on a table, and placed small signs beside each empty garden bed. Soon, neighbors began carrying in seedlings, watering cans, and bags of compost. An older gardener showed two children how to loosen roots without tearing them. Maya noticed that the tomato plants had been assigned to a shady corner, where they would not get enough afternoon sun. She checked the garden map and moved their sign to an open bed near the fence. Before anyone started digging, she explained the change to the group. Everyone agreed, and the children proudly carried the tomato seedlings to their new spot. By lunchtime, every bed was planted, and Maya returned the shed key to the garden coordinator.`,
    question: {
      prompt: 'Why did Maya move the sign for the tomato plants?',
      options: [
        ['more-sun', 'The new bed would receive more sunlight.'],
        ['near-tools', 'The new bed was closer to the tool shed.'],
        ['avoid-children', 'The children wanted a different place to work.'],
      ],
      answer: 'more-sun',
    },
  },
  {
    id: 'ferry-lost-scarf',
    version: 1,
    text: `Daniel took the late afternoon ferry across the bay to visit his sister. He chose a seat outside because the air was cool and the water was calm. Halfway through the trip, a bright blue scarf slid along the deck and caught against his shoe. Daniel looked around, but the nearby passengers were wearing jackets and did not seem to notice it. He picked up the scarf and carried it to a crew member by the cabin door. The crew member announced the lost item over a speaker. A few minutes later, a woman hurried from the upper deck and described a silver pin attached to one end. That detail matched the scarf, so the crew member returned it to her. She thanked Daniel and explained that the scarf had been a gift from her grandmother. When the ferry reached the harbor, Daniel left through the lower exit, pleased that he had not simply ignored what he found.`,
    question: {
      prompt: 'How did the crew member confirm who owned the scarf?',
      options: [
        ['ticket-check', 'The owner showed her ferry ticket.'],
        ['pin-description', 'The owner described its silver pin.'],
        ['seat-location', 'The owner named Daniel’s seat.'],
      ],
      answer: 'pin-description',
    },
  },
  {
    id: 'library-window-display',
    version: 1,
    text: `The town library invited volunteers to create a window display about local journeys. Priya brought an old road map, while other people contributed postcards, train tickets, and photographs of walking trails. At first, the group planned to arrange everything by date. However, several objects had no clear year, and the display looked crowded when they tested that idea on a long table. Priya suggested grouping the items by type of journey instead: road, rail, water, and foot. This made it easier to place the larger photographs behind smaller objects. The volunteers also wrote short labels in large print so people could read them from outside. Before closing time, they stepped onto the sidewalk to check the result through the glass. One corner seemed dark, so a librarian moved a small lamp closer. The finished display opened the next morning, and visitors soon began sharing stories about trips of their own.`,
    question: {
      prompt: 'Why did the volunteers stop arranging the display by date?',
      options: [
        ['missing-years', 'Some objects had no clear year.'],
        ['broken-glass', 'The window glass needed repair.'],
        ['short-labels', 'The labels were too short.'],
      ],
      answer: 'missing-years',
    },
  },
  {
    id: 'market-rain-plan',
    version: 1,
    text: `Every Thursday, vendors set up a small food market in the square beside the clock tower. Elena sold bread from a folding table near the fountain. One morning, dark clouds gathered while the vendors were unloading their boxes. The weather report had mentioned a brief shower, so most people continued preparing as usual. Elena noticed that wind was pushing the clouds faster than expected and that drops were already marking the pavement. Instead of opening her paper bags, she covered the bread and asked the flower seller to help move both tables beneath the stone arches. Other vendors followed, carrying fruit crates and jars into the sheltered walkway. Heavy rain arrived a few minutes later and lasted nearly an hour. Customers could still walk along the arches and shop without getting soaked. When the sun returned, Elena moved her sign back toward the square, but she kept the bread under cover until the ground dried.`,
    question: {
      prompt: 'What allowed the market to continue during the heavy rain?',
      options: [
        ['early-closing', 'The vendors closed before customers arrived.'],
        ['stone-shelter', 'The vendors moved beneath the stone arches.'],
        ['plastic-tent', 'Elena built a plastic tent by the fountain.'],
      ],
      answer: 'stone-shelter',
    },
  },
  {
    id: 'repair-cafe-lamp',
    version: 1,
    text: `At the monthly repair café, people brought household items that might otherwise be thrown away. Marcus arrived with a desk lamp that flickered whenever he moved its cord. He expected the volunteer to replace the bulb, but the bulb worked normally in another lamp. The volunteer unplugged the desk lamp and examined the cord under a bright light. Near the base, the outer covering had split, exposing a damaged wire. She explained that using the lamp in that condition could be unsafe. Marcus watched as she removed the worn section and attached a new plug, carefully securing each connection. Afterward, they tested the lamp on a protected outlet. It shone steadily even when Marcus gently moved the cord. He wrote the repair steps on a card so he would remember what had been done. Before leaving, Marcus helped another visitor carry a heavy wooden chair to the furniture table and donated a few coins for replacement parts.`,
    question: {
      prompt: 'What caused the desk lamp to flicker?',
      options: [
        ['loose-bulb', 'Its bulb was loose.'],
        ['damaged-wire', 'A wire near the cord’s base was damaged.'],
        ['weak-outlet', 'The café outlet supplied too little power.'],
      ],
      answer: 'damaged-wire',
    },
  },
  {
    id: 'museum-audio-tour',
    version: 1,
    text: `A small history museum was preparing a new audio tour for weekend visitors. Leo volunteered to test the recordings before the tour was released. He walked through each room with a borrowed headset, following the numbered signs beside the displays. Most tracks were clear, but the recording for the kitchen exhibit mentioned a red kettle on the left. The kettle had recently been moved to a shelf on the right, next to a row of bowls. Leo wrote down the mismatch and continued listening. He also found that one track ended before explaining why a wooden box had a narrow slot in its lid. After the test, he met the museum guide and shared his notes. They decided to update the kettle description and restore the missing final sentence. On Sunday, Leo returned with his parents. The corrected tour guided them smoothly through the rooms, and his father was especially interested in the wooden box, which had once collected station tickets.`,
    question: {
      prompt: 'What was wrong with the recording about the kitchen exhibit?',
      options: [
        ['wrong-color', 'It gave the wrong color for the kettle.'],
        ['wrong-location', 'It gave the wrong location for the kettle.'],
        ['missing-number', 'It omitted the exhibit number.'],
      ],
      answer: 'wrong-location',
    },
  },
  {
    id: 'park-bench-paint',
    version: 1,
    text: `The benches along Riverside Park had faded after several years of sun and winter weather. A neighborhood group received permission to repaint them on a quiet Tuesday. Noor and Ben began by brushing away dirt and loose chips of old paint. They placed signs at both ends of the path, asking walkers to use the grass beside the work area. Although the new green paint dried quickly in sunlight, one bench remained sticky much longer than the others. Noor looked up and saw that a wide tree branch kept it in deep shade. Rather than remove the warning tape at the planned time, she added a note explaining that the final bench was still wet. The volunteers cleaned their brushes and left the tape in place. Ben returned early the next morning and touched a hidden corner to check the surface. It was finally dry, so he removed the tape and signs before the first group of runners reached the path.`,
    question: {
      prompt: 'Why did one bench take longer to dry?',
      options: [
        ['extra-coat', 'It received an extra coat of paint.'],
        ['deep-shade', 'A tree branch kept it in deep shade.'],
        ['cold-river', 'Cold air rose from the river.'],
      ],
      answer: 'deep-shade',
    },
  },
  {
    id: 'bakery-order-mixup',
    version: 1,
    text: `On Friday afternoon, the bakery was busy filling orders for several weekend celebrations. Tessa labeled each box before placing cakes inside, but two customers had the same last name. One had ordered a lemon cake with white icing, while the other had requested chocolate with blue icing. When Tessa checked the pickup list, she noticed that both boxes were marked only “Morgan.” She did not want to open the boxes after they had been sealed. Instead, she compared the order numbers on the receipts with small numbered stickers beneath each box. The numbers showed which cake belonged to each customer. Tessa added the first names and cake flavors to the labels, then asked a coworker to check them again. The lemon cake was collected that evening, and the chocolate cake remained in the cooler for Saturday morning. Because Tessa corrected the labels before either pickup, both customers received the right cake without any delay or wasted food.`,
    question: {
      prompt: 'How did Tessa identify the cakes without opening the boxes?',
      options: [
        ['weighed-boxes', 'She weighed both boxes.'],
        ['matched-numbers', 'She matched receipt numbers to box stickers.'],
        ['called-customers', 'She called the customers for descriptions.'],
      ],
      answer: 'matched-numbers',
    },
  },
  {
    id: 'hilltop-picnic-route',
    version: 1,
    text: `Four friends planned a picnic at a hilltop viewpoint just outside town. The usual path was short but steep, and Rosa had recently hurt her ankle. At the trail entrance, they studied a map showing a second route that curved through the woods. It added nearly a kilometer, but its slope was gentle and there were benches along the way. The group chose the longer route and divided the picnic supplies so no one carried too much. They stopped once beside a stream, where Rosa rested while the others watched small birds in the branches. The path then joined a broad gravel road for the final climb. They reached the viewpoint later than originally planned, yet everyone still had enough energy to explore the flat area near the top. After lunch, clouds began covering the sun. The friends packed promptly and returned by the same gentle route, arriving at the trail entrance before the first drops of rain.`,
    question: {
      prompt: 'Why did the friends choose the longer route?',
      options: [
        ['better-view', 'It offered a better view of the town.'],
        ['gentler-slope', 'Its gentler slope suited Rosa’s injured ankle.'],
        ['more-sun', 'It stayed sunny later in the day.'],
      ],
      answer: 'gentler-slope',
    },
  },
  {
    id: 'station-clock-meeting',
    version: 1,
    text: `Ibrahim agreed to meet his cousin beside the large clock in Central Station at noon. He arrived ten minutes early and waited near the ticket machines, where he could clearly see the clock above the main entrance. At noon, his cousin was nowhere nearby. Ibrahim checked his phone and found a message saying, “I’m under the clock by platform six.” The station had recently installed a second large clock in the renovated platform hall, but neither cousin knew there were now two meeting places with the same description. Ibrahim asked an employee for directions and walked through the passage toward platform six. His cousin was waiting there with two cups of tea, also wondering about the delay. They laughed about the confusion and decided to be more specific next time. Before leaving for their train, Ibrahim sent a message to another relative joining them later: “Meet us beneath the platform six clock, beside the bookshop.”`,
    question: {
      prompt: 'Why did Ibrahim and his cousin wait in different places?',
      options: [
        ['changed-time', 'They had agreed on different meeting times.'],
        ['two-clocks', 'The station had two large clocks.'],
        ['wrong-station', 'Ibrahim went to the wrong station.'],
      ],
      answer: 'two-clocks',
    },
  },
];

export const getCalibrationPassageWordCount = (passage) =>
  passage.text.trim().split(/\s+/).length;
