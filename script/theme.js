/* ════════════════════════════════════════════════════════════════════
   theme.js — cspanel global colour-theme module (used by
   panel_all.html). 63 palettes. Sets CSS custom
   properties on :root, persists choice to localStorage, and renders a
   gallery picker. Same-origin localStorage → a choice on one page
   applies site-wide on the next load.

   Token contract (both pages must expose / consume these vars):
     --bg-base --bg-mesh-1..3 --accent --accent-hover --accent-2
     --accent-tint --accent-ring --selection-bg --user-bubble --link
     --success --warning --danger --code-bg --code-fg
     --tier-fast --tier-grounded --tier-deep --tier-max
   ════════════════════════════════════════════════════════════════════ */
(function () {
  const PALETTES = [{"id":"olive","name":"Olive（經典）","group":"cspanel 經典","bgBase":"#f2f3ec","mesh":["#e9edda","#eef0e3","#e5e9d8"],"accent":"#8d9c00","accentHover":"#6f7b00","success":"#4E8C6A","warning":"#C99A3C","danger":"#C0463C","tiers":["#4E8C6A","#8d9c00","#4A6A93","#C0463C"],"code":["#1a1c14","#e8ecdd"]},{"id":"iceland","name":"Iceland","group":"Glacier & Arctic","bgBase":"#eef1f4","mesh":["#e1ebf1","#dfeceb","#e7ece7"],"accent":"#327E8E","accentHover":"#276873","success":"#4E8C6A","warning":"#C99A3C","danger":"#C0463C","tiers":["#4E8C6A","#327E8E","#4A6A93","#C0463C"],"code":["#161b1f","#e3e8ec"]},{"id":"glacier-dawn","name":"Glacier Dawn","group":"Glacier & Arctic","bgBase":"#f3f7f9","mesh":["#eaf3f7","#eef4f4","#f3f6f8"],"accent":"#2f6f8f","accentHover":"#235569","success":"#3f8f6e","warning":"#c08a2c","danger":"#b24a44","tiers":["#6fa8bf","#2f6f8f","#274b6b","#b24a44"],"code":["#16242c","#dbe9ef"]},{"id":"arctic-twilight","name":"Arctic Twilight","group":"Glacier & Arctic","bgBase":"#f2f3fa","mesh":["#edeef8","#f0f0f7","#f2f3f9"],"accent":"#3b4f9e","accentHover":"#2c3c7c","success":"#3d8a78","warning":"#b6862f","danger":"#aa4a5e","tiers":["#7d88c2","#3b4f9e","#2a3463","#aa4a5e"],"code":["#171a2e","#dfe1f1"]},{"id":"polar-rose","name":"Polar Rose","group":"Glacier & Arctic","bgBase":"#f7f2f6","mesh":["#f6eef4","#f1eff7","#f3f4f9"],"accent":"#8a4f73","accentHover":"#6c3c59","success":"#48896f","warning":"#bd8730","danger":"#b14a55","tiers":["#bb88a6","#8a4f73","#5a3a6e","#b14a55"],"code":["#241823","#ecdfe8"]},{"id":"tidal-foam","name":"Tidal Foam","group":"Ocean & Coast","bgBase":"#f1f7fb","mesh":["#dceefa","#e7f5f3","#f0f3e7"],"accent":"#1f6fb0","accentHover":"#175888","success":"#2e9e7a","warning":"#d8a02a","danger":"#d24b48","tiers":["#5aa9d8","#1f6fb0","#1d4f7a","#d24b48"],"code":["#0e2a3d","#d6e8f2"]},{"id":"kelp-forest","name":"Kelp Forest","group":"Ocean & Coast","bgBase":"#eef5f1","mesh":["#dcefe6","#e3f0ea","#eaf1dd"],"accent":"#1d6b5f","accentHover":"#155249","success":"#3a8f5c","warning":"#c79328","danger":"#c85741","tiers":["#4f9d8c","#1d6b5f","#143f3d","#c85741"],"code":["#0d2723","#d2e9e0"]},{"id":"deep-current","name":"Deep Current","group":"Ocean & Coast","bgBase":"#eef1f7","mesh":["#dde3f2","#e4eaf5","#e9e6f1"],"accent":"#1b3a6b","accentHover":"#122a4f","success":"#2d8f87","warning":"#c9952f","danger":"#c84d5c","tiers":["#4f74b0","#1b3a6b","#0f2444","#c84d5c"],"code":["#0a1730","#cdd9f0"]},{"id":"storm-coast","name":"Storm Coast","group":"Ocean & Coast","bgBase":"#f0f2f5","mesh":["#e0e6ed","#e6eaef","#e9eaec"],"accent":"#3d5a73","accentHover":"#2d4456","success":"#46876e","warning":"#bf963c","danger":"#bf5a53","tiers":["#6c879e","#3d5a73","#283b4d","#bf5a53"],"code":["#13202b","#d4dde5"]},{"id":"coastal-aqua","name":"Coastal Aqua","group":"Ocean & Coast","bgBase":"#edf8f7","mesh":["#d7f1ef","#e2f4ec","#eef6e4"],"accent":"#0d8284","accentHover":"#0a6566","success":"#2ca36e","warning":"#dca534","danger":"#d4564f","tiers":["#46bdbe","#0d8284","#0a5b5d","#d4564f"],"code":["#062b2c","#cdeeed"]},{"id":"pine-hollow","name":"Pine Hollow","group":"Deep Forest & Moss","bgBase":"#f3f6f1","mesh":["#e2efe0","#dfece8","#eaf1dd"],"accent":"#2f6b46","accentHover":"#234f34","success":"#3f8a55","warning":"#c08a2a","danger":"#bb4b3f","tiers":["#6fa489","#2f6b46","#1d4a4f","#bb4b3f"],"code":["#16241d","#dbe9df"]},{"id":"fern-canopy","name":"Fern Canopy","group":"Deep Forest & Moss","bgBase":"#f4f7ee","mesh":["#e6f1da","#ddeede","#eef2d8"],"accent":"#4a7a2c","accentHover":"#385e20","success":"#5a9433","warning":"#c89324","danger":"#bf5235","tiers":["#8bb766","#4a7a2c","#2c5f3a","#bf5235"],"code":["#1c2614","#e2ecd6"]},{"id":"moss-creek","name":"Moss Creek","group":"Deep Forest & Moss","bgBase":"#eef6f2","mesh":["#dbeee5","#d9efea","#e6f2df"],"accent":"#2c7a5e","accentHover":"#205c46","success":"#359c6d","warning":"#bc9330","danger":"#bc5446","tiers":["#6fb59a","#2c7a5e","#1f5160","#bc5446"],"code":["#142420","#d6ece2"]},{"id":"deep-spruce","name":"Deep Spruce","group":"Deep Forest & Moss","bgBase":"#eff4f2","mesh":["#dde9e4","#d9e6e9","#e3ece2"],"accent":"#1f5946","accentHover":"#143f31","success":"#2f7d57","warning":"#a8842c","danger":"#a84a43","tiers":["#5e8f7e","#1f5946","#163f4a","#a84a43"],"code":["#0f1f1a","#d3e3dc"]},{"id":"sandstone-mesa","name":"Sandstone Mesa","group":"Desert & Canyon","bgBase":"#faf5ee","mesh":["#f6e7d4","#f3ddc9","#eee6da"],"accent":"#a76533","accentHover":"#824e27","success":"#5f8a4e","warning":"#c98a2b","danger":"#b23f33","tiers":["#c79a63","#a76533","#8a5a3c","#b23f33"],"code":["#2c2118","#f1e3d2"]},{"id":"red-clay-canyon","name":"Red Clay Canyon","group":"Desert & Canyon","bgBase":"#fbf2ec","mesh":["#f6dccc","#f5dace","#efe0d3"],"accent":"#a8442b","accentHover":"#86341f","success":"#6b8a45","warning":"#cf8624","danger":"#b03a2e","tiers":["#d08a5e","#a8442b","#7d3b2c","#b03a2e"],"code":["#2e1c14","#f3ddcf"]},{"id":"dusk-rose-bluff","name":"Dusk Rose Bluff","group":"Desert & Canyon","bgBase":"#fbf3f1","mesh":["#f4dde0","#f2dbd7","#eddfe2"],"accent":"#a85066","accentHover":"#873f53","success":"#5c8a6a","warning":"#c98a45","danger":"#b1424a","tiers":["#cf8fa0","#a85066","#7e4a66","#b1424a"],"code":["#2a1c20","#f1dde2"]},{"id":"high-desert-dusk","name":"High Desert Dusk","group":"Desert & Canyon","bgBase":"#f7f3f1","mesh":["#ecdfd9","#e8dde4","#ddddec"],"accent":"#8a5a72","accentHover":"#6d4459","success":"#608068","warning":"#c5872f","danger":"#b04a40","tiers":["#c08e8a","#8a5a72","#5f5a82","#b04a40"],"code":["#241c24","#ecdfe4"]},{"id":"basalt-ember","name":"Basalt Ember","group":"Volcanic & Geothermal","bgBase":"#f7f3f0","mesh":["#f6e7dc","#f3ddd6","#ece6e2"],"accent":"#b6431d","accentHover":"#8f3214","success":"#5c7d4f","warning":"#c98a16","danger":"#a8311c","tiers":["#c98a16","#b6431d","#6e3b2f","#a8311c"],"code":["#241a16","#f1ddca"]},{"id":"lava-flow","name":"Lava Flow","group":"Volcanic & Geothermal","bgBase":"#f8f1ee","mesh":["#f8e2d8","#f6d6cd","#f0e0db"],"accent":"#c43412","accentHover":"#99250b","success":"#557a4d","warning":"#d4830f","danger":"#b71f12","tiers":["#e07a16","#c43412","#7a2a1c","#b71f12"],"code":["#2a1511","#fad9c4"]},{"id":"geyser-basin","name":"Geyser Basin","group":"Volcanic & Geothermal","bgBase":"#eef4f4","mesh":["#d9eef0","#e2efe9","#ece9e4"],"accent":"#0c6e72","accentHover":"#085054","success":"#3f8569","warning":"#bb8918","danger":"#b53b22","tiers":["#3fa8ac","#0c6e72","#1f4d5a","#b53b22"],"code":["#10221f","#cfe9e3"]},{"id":"cinnabar-spring","name":"Cinnabar Spring","group":"Volcanic & Geothermal","bgBase":"#f8f1ed","mesh":["#f8ddd0","#f1e2d6","#e9e0dd"],"accent":"#a82f3a","accentHover":"#7f1f2a","success":"#4f7d5f","warning":"#c4811a","danger":"#b32434","tiers":["#d98a3e","#a82f3a","#5e3242","#b32434"],"code":["#26161a","#f3d6cd"]},{"id":"alpine-glacier-dawn","name":"Alpine Glacier Dawn","group":"Alpine Meadow & Mountain","bgBase":"#f1f5f9","mesh":["#dbeafe","#e0e7ff","#e7f0f7"],"accent":"#2563a8","accentHover":"#1d4d85","success":"#2f8f6b","warning":"#c98a23","danger":"#c0492f","tiers":["#5b9bd5","#2563a8","#34508c","#c0492f"],"code":["#16243a","#cfe0f2"]},{"id":"wildflower-bloom","name":"Wildflower Bloom","group":"Alpine Meadow & Mountain","bgBase":"#f7f3f8","mesh":["#ecdcf0","#e3d9f2","#f3dde8"],"accent":"#8a3c95","accentHover":"#6f2e79","success":"#4a9d5c","warning":"#cf952a","danger":"#c33a52","tiers":["#b56bbf","#8a3c95","#5c4aa3","#c33a52"],"code":["#291a2e","#ecd9f0"]},{"id":"granite-ridge","name":"Granite Ridge","group":"Alpine Meadow & Mountain","bgBase":"#f3f3f5","mesh":["#e2e3e8","#e6e2e0","#dde4ea"],"accent":"#4a5468","accentHover":"#363e4f","success":"#4f8a5e","warning":"#b58633","danger":"#b14a3e","tiers":["#7d8699","#4a5468","#5a6178","#b14a3e"],"code":["#1f2229","#d9dce3"]},{"id":"gentian-alpine","name":"Gentian Alpine","group":"Alpine Meadow & Mountain","bgBase":"#eef1fa","mesh":["#d8def7","#dde2f5","#e6e4f4"],"accent":"#3640b0","accentHover":"#272f8c","success":"#3a9466","warning":"#c08a1f","danger":"#c23c4a","tiers":["#6e74cf","#3640b0","#5a3aa0","#c23c4a"],"code":["#16193a","#d6daf4"]},{"id":"silt-river","name":"Silt River","group":"Wetland, River & Reed","bgBase":"#f5f3ee","mesh":["#e8e3d6","#dde6e3","#ece6da"],"accent":"#7a6a4f","accentHover":"#5f5239","success":"#5d7a4a","warning":"#b8893a","danger":"#a85240","tiers":["#8a9a8e","#7a6a4f","#4f6a5e","#a85240"],"code":["#2a2519","#e8e0cf"]},{"id":"willow-bend","name":"Willow Bend","group":"Wetland, River & Reed","bgBase":"#f2f4ec","mesh":["#e1ead6","#dde8dd","#eaecd9"],"accent":"#5a7a3e","accentHover":"#43602b","success":"#4f8a48","warning":"#b59230","danger":"#b04e3a","tiers":["#8aa98e","#5a7a3e","#3a6b54","#b04e3a"],"code":["#1f2615","#dfe9cd"]},{"id":"mist-estuary","name":"Mist Estuary","group":"Wetland, River & Reed","bgBase":"#eef2f2","mesh":["#dde8e8","#e2e9e4","#d9e3e8"],"accent":"#3f6e72","accentHover":"#2c5256","success":"#3e8067","warning":"#ad8a3c","danger":"#a85048","tiers":["#7fa3a6","#3f6e72","#345e7a","#a85048"],"code":["#16242a","#d4e6e6"]},{"id":"heron-dusk","name":"Heron Dusk","group":"Wetland, River & Reed","bgBase":"#f1eff2","mesh":["#e3dde8","#dfe3e6","#e8e0dd"],"accent":"#5a5076","accentHover":"#433a5c","success":"#4f7a5e","warning":"#b08a3e","danger":"#a84e5a","tiers":["#8f86a8","#5a5076","#4a5a7a","#a84e5a"],"code":["#1f1b2a","#e0dae8"]},{"id":"acacia-shade","name":"Acacia Shade","group":"Savanna & Grassland","bgBase":"#f4f6ec","mesh":["#e6efd6","#eef1da","#e2e9cf"],"accent":"#4d7028","accentHover":"#3a561c","success":"#4d7028","warning":"#bb961e","danger":"#a94528","tiers":["#9bab4c","#4d7028","#34532a","#a94528"],"code":["#1f2614","#e1ecc8"]},{"id":"terracotta-savanna","name":"Terracotta Savanna","group":"Savanna & Grassland","bgBase":"#faf3ec","mesh":["#f6e3d4","#f4ead9","#f1ddd0"],"accent":"#b05227","accentHover":"#8c3e1b","success":"#6b7d2a","warning":"#cc8a1e","danger":"#a83520","tiers":["#cc8a1e","#b05227","#7e3a24","#a83520"],"code":["#2c1c12","#f2dcc8"]},{"id":"savanna-dusk","name":"Savanna Dusk","group":"Savanna & Grassland","bgBase":"#f5f1ee","mesh":["#eddfdc","#e8e0e6","#f1e3d4"],"accent":"#9c4a4e","accentHover":"#7a383c","success":"#5f7a3e","warning":"#c98a2c","danger":"#a63a2e","tiers":["#d59a55","#9c4a4e","#5d3f54","#a63a2e"],"code":["#271a1c","#f0dcd8"]},{"id":"sunburnt-plain","name":"Sunburnt Plain","group":"Savanna & Grassland","bgBase":"#f8f2ea","mesh":["#f3e2cf","#efe6d2","#ecddcb"],"accent":"#8a5a2c","accentHover":"#6b441f","success":"#71792e","warning":"#c2861d","danger":"#a14224","tiers":["#c2861d","#8a5a2c","#5e4a32","#a14224"],"code":["#241a10","#eaddc6"]},{"id":"turquoise-lagoon","name":"Turquoise Lagoon","group":"Tropical Reef & Lagoon","bgBase":"#f0fbfa","mesh":["#d8f4f0","#e6f6ec","#dff0fa"],"accent":"#0d8282","accentHover":"#0a6565","success":"#1f9d6b","warning":"#d99413","danger":"#d24a52","tiers":["#3bb6c4","#0d8282","#0c6478","#d24a52"],"code":["#0c2b2e","#cdeeea"]},{"id":"coral-shoal","name":"Coral Shoal","group":"Tropical Reef & Lagoon","bgBase":"#fdf4f1","mesh":["#fbe1da","#fceee2","#dff1ef"],"accent":"#d14331","accentHover":"#a43324","success":"#3d9b78","warning":"#dd9512","danger":"#c33b3b","tiers":["#f0936f","#d14331","#2aa3a3","#c33b3b"],"code":["#2e1715","#f6ddd5"]},{"id":"deep-atoll","name":"Deep Atoll","group":"Tropical Reef & Lagoon","bgBase":"#eef6fa","mesh":["#d3e9f3","#dceef0","#e1e8f6"],"accent":"#1763a6","accentHover":"#114e84","success":"#1f967e","warning":"#cc8a1c","danger":"#cf4357","tiers":["#3fa3c9","#1763a6","#1c8e8e","#cf4357"],"code":["#0d2236","#cfe5f3"]},{"id":"anemone-tide","name":"Anemone Tide","group":"Tropical Reef & Lagoon","bgBase":"#fbf2f7","mesh":["#f6dcea","#ecdef4","#daeff1"],"accent":"#b53d7a","accentHover":"#922f62","success":"#2f9c7c","warning":"#cf911a","danger":"#c63b54","tiers":["#e07cb0","#b53d7a","#6a45a6","#c63b54"],"code":["#2a1322","#f3d8e7"]},{"id":"aurora-veil","name":"Aurora Veil","group":"Night, Aurora & Cosmos","bgBase":"#f3f6f4","mesh":["#dff3e6","#e2eef6","#ece6f5"],"accent":"#1f7a5c","accentHover":"#175e47","success":"#2e8f5f","warning":"#c8941f","danger":"#c0453f","tiers":["#4aa6c4","#1f7a5c","#5b4aa8","#c0453f"],"code":["#0d1f1a","#cfe8dc"]},{"id":"deep-indigo-night","name":"Deep Indigo Night","group":"Night, Aurora & Cosmos","bgBase":"#f2f2f7","mesh":["#e3e2f3","#e7ecf7","#efe5f1"],"accent":"#3a3f8f","accentHover":"#2c3070","success":"#3c8a6e","warning":"#c79324","danger":"#bf4150","tiers":["#5b8fd6","#3a3f8f","#7a4fa8","#bf4150"],"code":["#13152e","#d6d8ee"]},{"id":"violet-nebula","name":"Violet Nebula","group":"Night, Aurora & Cosmos","bgBase":"#f6f3f7","mesh":["#ece2f3","#f1e4ee","#e4e6f5"],"accent":"#6a3d96","accentHover":"#522d77","success":"#3f8a6c","warning":"#c88a2a","danger":"#c34467","tiers":["#5a8ad0","#6a3d96","#a44897","#c34467"],"code":["#1a1230","#e0d4ee"]},{"id":"cosmic-ember","name":"Cosmic Ember","group":"Night, Aurora & Cosmos","bgBase":"#f6f3f4","mesh":["#ece1ec","#e8e3f2","#f3e6e6"],"accent":"#8a3f7a","accentHover":"#6c305f","success":"#42876a","warning":"#cc8a2c","danger":"#c44354","tiers":["#5572bd","#8a3f7a","#b14a86","#c44354"],"code":["#22132a","#ecd9e6"]},{"id":"maple-ember","name":"Maple Ember","group":"Autumn & Harvest","bgBase":"#fbf4ee","mesh":["#fbe2d4","#f8e8d6","#f3ddd9"],"accent":"#c0461f","accentHover":"#9c3416","success":"#5a7c3a","warning":"#cc8a16","danger":"#b42d26","tiers":["#d98a45","#c0461f","#8c4a2b","#b42d26"],"code":["#2c1810","#f6dcc8"]},{"id":"amber-orchard","name":"Amber Orchard","group":"Autumn & Harvest","bgBase":"#fcf6e9","mesh":["#fbeccd","#f9f0d6","#f6e6c6"],"accent":"#a36810","accentHover":"#7f510c","success":"#6b7e2c","warning":"#d99a0f","danger":"#bb3a23","tiers":["#e0a93a","#a36810","#7a531a","#bb3a23"],"code":["#2b2008","#f5e4c0"]},{"id":"russet-grove","name":"Russet Grove","group":"Autumn & Harvest","bgBase":"#f9f1ec","mesh":["#f4dcce","#f1e0d2","#efdcd5"],"accent":"#9a3d1c","accentHover":"#782d13","success":"#5d7338","warning":"#c58219","danger":"#a82f22","tiers":["#cb7a3e","#9a3d1c","#6e3a25","#a82f22"],"code":["#291309","#f0d6c4"]},{"id":"crimson-vineyard","name":"Crimson Vineyard","group":"Autumn & Harvest","bgBase":"#faf1f0","mesh":["#f3d8d4","#f4ddd0","#f1dadd"],"accent":"#9c2b2e","accentHover":"#7a1f24","success":"#5e7338","warning":"#c5821b","danger":"#aa2a26","tiers":["#cc6f47","#9c2b2e","#6f3535","#aa2a26"],"code":["#26100f","#f1d4cf"]},{"id":"lavender-haze","name":"Lavender Haze","group":"Bloom & Botanical","bgBase":"#f7f5fb","mesh":["#ebe6f7","#f0e8f3","#e7eaf6"],"accent":"#7c5ccf","accentHover":"#634aa8","success":"#4f9d6e","warning":"#c98a2b","danger":"#c4495a","tiers":["#6f9bd1","#7c5ccf","#9456b8","#c4495a"],"code":["#221b33","#e8e0f5"]},{"id":"rose-quartz","name":"Rose Quartz","group":"Bloom & Botanical","bgBase":"#fbf5f6","mesh":["#f7e4e8","#f6e7ee","#f3e8e4"],"accent":"#c64a72","accentHover":"#a23a5c","success":"#519a6b","warning":"#cd8a2a","danger":"#c4413f","tiers":["#d98a6e","#c64a72","#9a4a8e","#c4413f"],"code":["#2e1c24","#f6e1e8"]},{"id":"leaf-garden","name":"Leaf Garden","group":"Bloom & Botanical","bgBase":"#f4f8f3","mesh":["#e2f0e3","#e8f2e2","#eef0df"],"accent":"#3e8349","accentHover":"#306638","success":"#3f9656","warning":"#c79029","danger":"#cb5141","tiers":["#7abf6e","#3e8349","#2f8f6e","#cb5141"],"code":["#172414","#e3f1de"]},{"id":"wisteria-dusk","name":"Wisteria Dusk","group":"Bloom & Botanical","bgBase":"#f6f4fa","mesh":["#e6e2f4","#ece3f0","#e3e7f2"],"accent":"#6650b8","accentHover":"#503f94","success":"#4d9a72","warning":"#bf8b34","danger":"#bd485f","tiers":["#8f7ad0","#6650b8","#a64fa8","#bd485f"],"code":["#1d1830","#e6e0f3"]},{"id":"peony-bloom","name":"Peony Bloom","group":"Bloom & Botanical","bgBase":"#fbf4f7","mesh":["#f8e0ec","#f7e6ef","#f5e2e9"],"accent":"#cd3a84","accentHover":"#a32966","success":"#4f9c74","warning":"#d18a2c","danger":"#c93f55","tiers":["#e0739b","#cd3a84","#9b3f9c","#c93f55"],"code":["#2d1722","#f8dde9"]},{"id":"tokyo-neon","name":"Tokyo Neon","group":"City · Neon Dusk","bgBase":"#f2f1f6","mesh":["#e6e3f0","#ece3ea","#e0e6ef"],"accent":"#7A3E8F","accentHover":"#5F2F70","success":"#3F8A6C","warning":"#C9973A","danger":"#C24558","tiers":["#4E9BA8","#7A3E8F","#3C3F7A","#C24558"],"code":["#1B1626","#E6E0F0"]},
{"id":"hongkong-harbour","name":"Hong Kong Harbour","group":"City · Neon Dusk","bgBase":"#eef3f6","mesh":["#dceaf2","#e2ecee","#ece7ea"],"accent":"#1F7A8C","accentHover":"#175F6E","success":"#3E8F6B","warning":"#D19A2E","danger":"#C74E5B","tiers":["#54B0BE","#1F7A8C","#45508F","#C74E5B"],"code":["#0F2230","#D8E8EF"]},
{"id":"taipei-dadaocheng","name":"Taipei Dadaocheng","group":"City · Neon Dusk","bgBase":"#f8f4ee","mesh":["#f2e6d8","#ece7dc","#e7e9e0"],"accent":"#9A4A38","accentHover":"#7A392B","success":"#5E8253","warning":"#C08A2E","danger":"#B03A30","tiers":["#C08A2E","#9A4A38","#5A6B5D","#B03A30"],"code":["#291A14","#F0E0D4"]},
{"id":"seoul-hangang","name":"Seoul Hangang","group":"City · Neon Dusk","bgBase":"#eff3f5","mesh":["#dfe9f0","#e6ecec","#eae7ee"],"accent":"#33648F","accentHover":"#274E70","success":"#3F8F70","warning":"#C6942F","danger":"#C04A50","tiers":["#6FA3C4","#33648F","#5A4E8F","#C04A50"],"code":["#131E2A","#DCE6EE"]},
{"id":"paris-limestone","name":"Paris Limestone","group":"City · Stone & Boulevard","bgBase":"#f7f4ee","mesh":["#efe8da","#e9e6e0","#e3e6e8"],"accent":"#4F6B8A","accentHover":"#3C536C","success":"#56855C","warning":"#C29040","danger":"#B24A3E","tiers":["#8FA6BD","#4F6B8A","#6B5A78","#B24A3E"],"code":["#20242C","#EAE4D8"]},
{"id":"london-fog","name":"London Fog","group":"City · Stone & Boulevard","bgBase":"#f1f2f1","mesh":["#e3e6e6","#e8e6e1","#dfe3e8"],"accent":"#7A4046","accentHover":"#5E3136","success":"#4C7D5E","warning":"#B98E3C","danger":"#B0433F","tiers":["#98A8A0","#7A4046","#3F5666","#B0433F"],"code":["#1D2124","#E2E5E4"]},
{"id":"barcelona-eixample","name":"Barcelona Eixample","group":"City · Stone & Boulevard","bgBase":"#faf4ec","mesh":["#f4e4cf","#ecebd8","#dfeae6"],"accent":"#2E7D8C","accentHover":"#22626E","success":"#5F8C48","warning":"#D29A2A","danger":"#BF4B33","tiers":["#D29A2A","#2E7D8C","#8A5A38","#BF4B33"],"code":["#14262B","#DCEAE6"]},
{"id":"vienna-ringstrasse","name":"Vienna Ringstrasse","group":"City · Stone & Boulevard","bgBase":"#f6f4ef","mesh":["#ece8db","#e4e9e2","#e9e4e8"],"accent":"#2F6B4F","accentHover":"#24523C","success":"#3F8A5C","warning":"#C69433","danger":"#B4453F","tiers":["#7FA88F","#2F6B4F","#54527E","#B4453F"],"code":["#16211B","#DFE8E0"]},
{"id":"manhattan-grid","name":"Manhattan Grid","group":"City · Concrete & Glass","bgBase":"#f2f2f3","mesh":["#e4e5e8","#e9e6e2","#dfe2e6"],"accent":"#3A4A5C","accentHover":"#2B3846","success":"#45836A","warning":"#D9A016","danger":"#B7423C","tiers":["#8895A3","#3A4A5C","#232D3A","#B7423C"],"code":["#15191E","#DDE1E6"]},
{"id":"berlin-concrete","name":"Berlin Concrete","group":"City · Concrete & Glass","bgBase":"#f3f2ef","mesh":["#e6e4de","#e2e5e6","#eae6e0"],"accent":"#5A6152","accentHover":"#454B3F","success":"#4E8258","warning":"#D0A21C","danger":"#AE453B","tiers":["#9AA090","#5A6152","#3C4A55","#AE453B"],"code":["#1B1D19","#E3E4DE"]},
{"id":"singapore-marina","name":"Singapore Marina","group":"City · Concrete & Glass","bgBase":"#eef6f4","mesh":["#d9efe8","#e4f2ea","#e7eef7"],"accent":"#0E7D6C","accentHover":"#0A6154","success":"#2E9C6A","warning":"#CE9426","danger":"#C6484E","tiers":["#4FB39F","#0E7D6C","#2F5E8C","#C6484E"],"code":["#0C2622","#D2ECE5"]},
{"id":"copenhagen-harbour","name":"Copenhagen Harbour","group":"City · Concrete & Glass","bgBase":"#f2f4f6","mesh":["#dfe8f0","#e8e9e4","#f0e6df"],"accent":"#35597A","accentHover":"#284563","success":"#47845F","warning":"#C89340","danger":"#B94A44","tiers":["#7FA0BC","#35597A","#8A5A4A","#B94A44"],"code":["#121C26","#DBE4EC"]}];
  const LS_KEY = 'cspanel.theme.v1';
  const DEFAULT_ID = 'olive';
  const byId = {};
  PALETTES.forEach(p => { byId[p.id] = p; });

  function hexToRgb(h) {
    h = String(h || '').trim().replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(hex, a) { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }
  function lighten(hex, amt) {
    const [r, g, b] = hexToRgb(hex);
    const f = c => Math.round(c + (255 - c) * amt);
    return '#' + [f(r), f(g), f(b)].map(c => c.toString(16).padStart(2, '0')).join('');
  }

  function applyTheme(p) {
    if (!p) return;
    const s = document.documentElement.style;
    const set = (k, v) => s.setProperty(k, v);
    set('--bg-base', p.bgBase);
    set('--bg-mesh-1', p.mesh[0]); set('--bg-mesh-2', p.mesh[1]); set('--bg-mesh-3', p.mesh[2]);
    set('--accent', p.accent);
    set('--accent-hover', p.accentHover);
    set('--accent-2', lighten(p.accent, 0.22));
    set('--accent-tint', rgba(p.accent, 0.12));
    set('--accent-ring', rgba(p.accent, 0.28));
    set('--selection-bg', rgba(p.accent, 0.20));
    set('--user-bubble', rgba(p.accent, 0.10));
    set('--link', p.accent);
    set('--success', p.success); set('--warning', p.warning); set('--danger', p.danger);
    set('--code-bg', p.code[0]); set('--code-fg', p.code[1]);
    set('--tier-fast', p.tiers[0]); set('--tier-grounded', p.tiers[1]);
    set('--tier-deep', p.tiers[2]); set('--tier-max', p.tiers[3]);
    try { document.dispatchEvent(new CustomEvent('cspanel:themechange', { detail: { id: p.id, name: p.name } })); } catch (e) {}
  }

  let activeId = DEFAULT_ID;
  let authed = false;
  function setTheme(id) {
    if (!authed) return;
    const p = byId[id]; if (!p) return;
    activeId = id; applyTheme(p);
    try { localStorage.setItem(LS_KEY, id); } catch (e) {}
    markActive();
    // Persist to the signed-in user's D1 settings (best-effort; silently
    // no-ops when anonymous / offline / served without the Worker).
    try {
      fetch('/api/me/preferences', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ theme: id }),
      }).catch(function () {});
    } catch (e) {}
  }
  // On load, pull the signed-in user's saved theme from D1 and apply it
  // (server is authoritative for authenticated users). Best-effort.
  function syncFromServer() {
    if (!authed) return;
    try {
      fetch('/api/me', { headers: { 'accept': 'application/json' } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (!authed) return;
          var t = d && d.preferences && d.preferences.theme;
          if (t && byId[t] && t !== activeId) {
            activeId = t; applyTheme(byId[t]);
            try { localStorage.setItem(LS_KEY, t); } catch (e) {}
            markActive();
          }
        }).catch(function () {});
    } catch (e) {}
  }
  function loadTheme() {
    let id = DEFAULT_ID;
    try { id = localStorage.getItem(LS_KEY) || DEFAULT_ID; } catch (e) {}
    if (!byId[id]) id = DEFAULT_ID;
    activeId = id;
  }
  function resetTheme() {
    const s = document.documentElement.style;
    ['--bg-base','--bg-mesh-1','--bg-mesh-2','--bg-mesh-3','--accent','--accent-hover','--accent-2','--accent-tint','--accent-ring','--selection-bg','--user-bubble','--link','--success','--warning','--danger','--code-bg','--code-fg','--tier-fast','--tier-grounded','--tier-deep','--tier-max'].forEach(function(k){ s.removeProperty(k); });
  }
  function onAuthLogin() { authed = true; applyTheme(byId[activeId] || byId[DEFAULT_ID]); markActive(); syncFromServer(); }
  function onAuthLogout() { authed = false; closePicker(); resetTheme(); }
  window.addEventListener('firework-login-success', onAuthLogin);
  window.addEventListener('firework-logout-success', onAuthLogout);
  window.addEventListener('firework-force-logout', onAuthLogout);

  /* ── gallery picker (built lazily) ─────────────────────────────── */
  let modal = null;
  function ensureStyle() {
    if (document.getElementById('tk-theme-style')) return;
    const s = document.createElement('style');
    s.id = 'tk-theme-style';
    s.textContent = `
      .tk-theme-modal{ position:fixed; inset:0; z-index:calc(var(--layer-modal) + 10); display:none; align-items:center; justify-content:center; padding:16px; background:rgba(18,22,26,0.45); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); }
      .tk-theme-modal.open{ display:flex; animation:tkfade .2s ease; }
      @keyframes tkfade{ from{ opacity:0 } }
      .tk-theme-panel{ width:min(920px,100%); max-height:88vh; display:flex; flex-direction:column; font-family:var(--sans, system-ui, sans-serif); color:var(--fg,#1d1d1f);
        background:var(--glass-bg-hover, rgba(255,255,255,0.85)); backdrop-filter:blur(40px) saturate(1.7); -webkit-backdrop-filter:blur(40px) saturate(1.7);
        border:1px solid var(--glass-border, rgba(255,255,255,0.5)); border-radius:20px; box-shadow:0 30px 80px rgba(0,0,0,0.3); overflow:hidden; }
      .tk-theme-head{ padding:16px 20px; border-bottom:1px solid var(--border, rgba(0,0,0,0.08)); display:flex; align-items:baseline; gap:12px; flex-shrink:0; }
      .tk-theme-title{ font-size:17px; font-weight:600; }
      .tk-theme-sub{ font-size:12px; color:var(--muted,#8a8a8a); }
      .tk-theme-close{ margin-left:auto; width:30px; height:30px; border-radius:8px; border:none; background:none; cursor:pointer; color:var(--fg-2,#555); font-size:17px; line-height:1; }
      .tk-theme-close:hover{ background:var(--bg-soft, rgba(0,0,0,0.05)); }
      .tk-theme-body{ padding:8px 20px 20px; overflow-y:auto; }
      .tk-theme-grouplabel{ font-family:var(--mono, ui-monospace, monospace); font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:var(--muted,#8a8a8a); margin:16px 2px 8px; }
      .tk-theme-grid{ display:grid; grid-template-columns:repeat(auto-fill, minmax(148px,1fr)); gap:10px; }
      .tk-sw{ display:flex; flex-direction:column; gap:6px; padding:6px; border:1px solid var(--border, rgba(0,0,0,0.08)); border-radius:12px; background:var(--glass-bg, rgba(255,255,255,0.5)); cursor:pointer; text-align:left; transition:transform .15s cubic-bezier(0.34,1.3,0.64,1), box-shadow .15s, border-color .15s; }
      .tk-sw:hover{ transform:translateY(-2px); box-shadow:0 8px 20px rgba(0,0,0,0.12); }
      .tk-sw.active{ border-color:var(--a); box-shadow:0 0 0 2px var(--a); }
      .tk-sw-prev{ height:48px; border-radius:8px; overflow:hidden; background:linear-gradient(135deg, var(--m1), var(--m2) 55%, var(--m3)); display:flex; align-items:center; padding:0 10px; gap:7px; }
      .tk-sw-bar{ height:15px; border-radius:8px; flex:1; background:var(--a); box-shadow:0 1px 2px rgba(0,0,0,0.12); }
      .tk-sw-dots{ display:flex; gap:3px; }
      .tk-sw-dot{ width:7px; height:7px; border-radius:50%; box-shadow:0 0 0 1px rgba(255,255,255,0.5) inset; }
      .tk-sw-name{ font-size:12.5px; font-weight:500; padding:0 2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      @media (prefers-reduced-motion: reduce){ .tk-theme-modal.open{ animation:none; } .tk-sw:hover{ transform:none; } }
    `;
    document.head.appendChild(s);
  }

  function buildModal() {
    if (modal) return;
    ensureStyle();
    modal = document.createElement('div');
    modal.className = 'tk-theme-modal';
    const groups = [];
    const seen = {};
    PALETTES.forEach(p => { if (!seen[p.group]) { seen[p.group] = []; groups.push(p.group); } seen[p.group].push(p); });
    let body = '';
    groups.forEach(g => {
      body += `<div class="tk-theme-grouplabel">${esc(g)}</div><div class="tk-theme-grid">`;
      seen[g].forEach(p => {
        const dots = p.tiers.map(t => `<span class="tk-sw-dot" style="background:${esc(t)}"></span>`).join('');
        body += `<button class="tk-sw" data-id="${esc(p.id)}" style="--a:${esc(p.accent)};--m1:${esc(p.mesh[0])};--m2:${esc(p.mesh[1])};--m3:${esc(p.mesh[2])}">`
          + `<span class="tk-sw-prev"><span class="tk-sw-bar"></span><span class="tk-sw-dots">${dots}</span></span>`
          + `<span class="tk-sw-name">${esc(p.name)}</span></button>`;
      });
      body += `</div>`;
    });
    modal.innerHTML = `<div class="tk-theme-panel">
      <div class="tk-theme-head"><span class="tk-theme-title">配色主題</span><span class="tk-theme-sub">${PALETTES.length} 組主題 · 自然與城市 · 點擊即時套用並儲存</span><button class="tk-theme-close" aria-label="關閉">✕</button></div>
      <div class="tk-theme-body">${body}</div></div>`;
    modal.addEventListener('click', e => {
      if (e.target === modal || e.target.closest('.tk-theme-close')) { closePicker(); return; }
      const sw = e.target.closest('.tk-sw');
      if (sw) setTheme(sw.dataset.id);
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closePicker(); });
    document.body.appendChild(modal);
  }
  function markActive() {
    if (!modal) return;
    modal.querySelectorAll('.tk-sw').forEach(el => el.classList.toggle('active', el.dataset.id === activeId));
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function openPicker() { if (!authed) return; buildModal(); modal.classList.add('open'); markActive(); }
  function closePicker() { if (modal) modal.classList.remove('open'); }

  window.CspanelTheme = {
    palettes: PALETTES,
    setTheme, openPicker, closePicker,
    getActiveId: () => activeId,
  };

  loadTheme();
})();
