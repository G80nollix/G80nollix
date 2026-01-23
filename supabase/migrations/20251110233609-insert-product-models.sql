-- Inserisci modelli per i brand presenti nel database

-- Arc'teryx (abbigliamento outdoor)
INSERT INTO product_model (name, id_brand) VALUES
('Alpha SV Jacket', (SELECT id FROM product_brand WHERE name = 'Arc''teryx')),
('Beta AR Jacket', (SELECT id FROM product_brand WHERE name = 'Arc''teryx')),
('Atom LT Hoody', (SELECT id FROM product_brand WHERE name = 'Arc''teryx')),
('Gamma LT Pant', (SELECT id FROM product_brand WHERE name = 'Arc''teryx'));

-- Atomic (sci)
INSERT INTO product_model (name, id_brand) VALUES
('Redster S9', (SELECT id FROM product_brand WHERE name = 'Atomic')),
('Hawx Ultra 130', (SELECT id FROM product_brand WHERE name = 'Atomic')),
('Bent Chetler 100', (SELECT id FROM product_brand WHERE name = 'Atomic')),
('Vantage 90 Ti', (SELECT id FROM product_brand WHERE name = 'Atomic'));

-- Bauer (hockey)
INSERT INTO product_model (name, id_brand) VALUES
('Vapor 3X Pro', (SELECT id FROM product_brand WHERE name = 'Bauer')),
('Supreme 3S Pro', (SELECT id FROM product_brand WHERE name = 'Bauer')),
('Nexus N9', (SELECT id FROM product_brand WHERE name = 'Bauer')),
('Elite Stick', (SELECT id FROM product_brand WHERE name = 'Bauer'));

-- Black Diamond (arrampicata/outdoor)
INSERT INTO product_model (name, id_brand) VALUES
('Solution Harness', (SELECT id FROM product_brand WHERE name = 'Black Diamond')),
('Camalot C4', (SELECT id FROM product_brand WHERE name = 'Black Diamond')),
('Vector Helmet', (SELECT id FROM product_brand WHERE name = 'Black Diamond')),
('Distance Z Trekking Poles', (SELECT id FROM product_brand WHERE name = 'Black Diamond'));

-- Burton (snowboard)
INSERT INTO product_model (name, id_brand) VALUES
('Custom X', (SELECT id FROM product_brand WHERE name = 'Burton')),
('Process', (SELECT id FROM product_brand WHERE name = 'Burton')),
('Deep Thinker', (SELECT id FROM product_brand WHERE name = 'Burton')),
('Family Tree Hometown Hero', (SELECT id FROM product_brand WHERE name = 'Burton'));

-- CCM (hockey)
INSERT INTO product_model (name, id_brand) VALUES
('Tacks AS-V Pro', (SELECT id FROM product_brand WHERE name = 'CCM')),
('Jetspeed FT4 Pro', (SELECT id FROM product_brand WHERE name = 'CCM')),
('Ribcor Trigger 7 Pro', (SELECT id FROM product_brand WHERE name = 'CCM')),
('Super Tacks AS1', (SELECT id FROM product_brand WHERE name = 'CCM'));

-- Head (sci)
INSERT INTO product_model (name, id_brand) VALUES
('Kore 93', (SELECT id FROM product_brand WHERE name = 'Head')),
('Supershape i.Rally', (SELECT id FROM product_brand WHERE name = 'Head')),
('Monster 88', (SELECT id FROM product_brand WHERE name = 'Head')),
('V-Shape V10', (SELECT id FROM product_brand WHERE name = 'Head'));

-- HEAD (duplicato - stesso brand, usando nomi diversi per evitare conflitti)
INSERT INTO product_model (name, id_brand) VALUES
('Kore 93 HEAD', (SELECT id FROM product_brand WHERE name = 'HEAD')),
('Supershape i.Rally HEAD', (SELECT id FROM product_brand WHERE name = 'HEAD')),
('Monster 88 HEAD', (SELECT id FROM product_brand WHERE name = 'HEAD'));

-- Jones (snowboard)
INSERT INTO product_model (name, id_brand) VALUES
('Ultra Mountain Twin', (SELECT id FROM product_brand WHERE name = 'Jones')),
('Hovercraft', (SELECT id FROM product_brand WHERE name = 'Jones')),
('Mind Expander', (SELECT id FROM product_brand WHERE name = 'Jones')),
('Flagship', (SELECT id FROM product_brand WHERE name = 'Jones'));

-- Lib Tech (snowboard)
INSERT INTO product_model (name, id_brand) VALUES
('Orca', (SELECT id FROM product_brand WHERE name = 'Lib Tech')),
('T.Rice Pro', (SELECT id FROM product_brand WHERE name = 'Lib Tech')),
('Box Knife', (SELECT id FROM product_brand WHERE name = 'Lib Tech')),
('Skunk Ape', (SELECT id FROM product_brand WHERE name = 'Lib Tech'));

-- Mammut (arrampicata/outdoor)
INSERT INTO product_model (name, id_brand) VALUES
('Eiger Extreme Jacket', (SELECT id FROM product_brand WHERE name = 'Mammut')),
('Nordwand Pro HS Jacket', (SELECT id FROM product_brand WHERE name = 'Mammut')),
('Trion Light Jacket', (SELECT id FROM product_brand WHERE name = 'Mammut')),
('Ultimate V S Light', (SELECT id FROM product_brand WHERE name = 'Mammut'));

-- MSR (attrezzatura outdoor)
INSERT INTO product_model (name, id_brand) VALUES
('Hubba Hubba NX 2', (SELECT id FROM product_brand WHERE name = 'MSR')),
('Reactor Stove', (SELECT id FROM product_brand WHERE name = 'MSR')),
('WindBurner Stove', (SELECT id FROM product_brand WHERE name = 'MSR')),
('Elixir 2 Tent', (SELECT id FROM product_brand WHERE name = 'MSR'));

-- Patagonia (abbigliamento outdoor)
INSERT INTO product_model (name, id_brand) VALUES
('Down Sweater Jacket', (SELECT id FROM product_brand WHERE name = 'Patagonia')),
('Nano Puff Jacket', (SELECT id FROM product_brand WHERE name = 'Patagonia')),
('R1 Air Hoody', (SELECT id FROM product_brand WHERE name = 'Patagonia')),
('Houdini Jacket', (SELECT id FROM product_brand WHERE name = 'Patagonia'));

-- Ride (snowboard)
INSERT INTO product_model (name, id_brand) VALUES
('Warpig', (SELECT id FROM product_brand WHERE name = 'Ride')),
('Superpig', (SELECT id FROM product_brand WHERE name = 'Ride')),
('Helix', (SELECT id FROM product_brand WHERE name = 'Ride')),
('Burnout', (SELECT id FROM product_brand WHERE name = 'Ride'));

-- Rossignol (sci)
INSERT INTO product_model (name, id_brand) VALUES
('Hero Elite ST Ti', (SELECT id FROM product_brand WHERE name = 'Rossignol')),
('Experience 88 Ti', (SELECT id FROM product_brand WHERE name = 'Rossignol')),
('Black Ops 98', (SELECT id FROM product_brand WHERE name = 'Rossignol')),
('Soul 7 HD', (SELECT id FROM product_brand WHERE name = 'Rossignol'));

-- Salomon (sci/outdoor)
INSERT INTO product_model (name, id_brand) VALUES
('QST 98', (SELECT id FROM product_brand WHERE name = 'Salomon')),
('S/Force Bold', (SELECT id FROM product_brand WHERE name = 'Salomon')),
('Shift Binding', (SELECT id FROM product_brand WHERE name = 'Salomon')),
('X Ultra 4 GTX', (SELECT id FROM product_brand WHERE name = 'Salomon'));

-- The North Face (abbigliamento outdoor)
INSERT INTO product_model (name, id_brand) VALUES
('Nuptse Jacket', (SELECT id FROM product_brand WHERE name = 'The North Face')),
('Apex Bionic 2 Jacket', (SELECT id FROM product_brand WHERE name = 'The North Face')),
('Thermoball Eco Jacket', (SELECT id FROM product_brand WHERE name = 'The North Face')),
('Venture 2 Jacket', (SELECT id FROM product_brand WHERE name = 'The North Face'));

-- TSL (racchette da neve)
INSERT INTO product_model (name, id_brand) VALUES
('Symbioz Elite', (SELECT id FROM product_brand WHERE name = 'TSL')),
('Symbioz Hyperflex', (SELECT id FROM product_brand WHERE name = 'TSL')),
('Symbioz Adventure', (SELECT id FROM product_brand WHERE name = 'TSL')),
('225 Elite', (SELECT id FROM product_brand WHERE name = 'TSL'));

-- Tubbs (racchette da neve)
INSERT INTO product_model (name, id_brand) VALUES
('Flex VRT', (SELECT id FROM product_brand WHERE name = 'Tubbs')),
('Flex TRK', (SELECT id FROM product_brand WHERE name = 'Tubbs')),
('Flex ALP', (SELECT id FROM product_brand WHERE name = 'Tubbs')),
('Flex VRT Carbon', (SELECT id FROM product_brand WHERE name = 'Tubbs'));

