-- Read-only diagnostic for assembly demand pooling (replenishment).
-- Run manually against the live ActiveOne DB to verify that item_components
-- is populated and that the QUANTITY grain matches the pooling assumption:
--   QUANTITY = input units consumed per ONE assembled output unit
--   (e.g. 1kg pack -> sack: QUANTITY = 0.04 if a sack fills 25 packs).
-- If live data shows the inverse grain (e.g. 25), the ratio direction in
-- src/replenishment/infrastructure/assemblyPooling.ts must flip.

-- 1. Overview: how much assembly data exists at all.
SELECT COUNT(*)                              AS total_component_rows,
       COUNT(DISTINCT ic.ITEM_ID)            AS items_with_components,
       SUM(CASE WHEN cnt.component_count = 1 THEN 1 ELSE 0 END) AS single_input_assemblies,
       SUM(CASE WHEN cnt.component_count > 1 THEN 1 ELSE 0 END) AS multi_input_assemblies
FROM item_components ic
JOIN (
  SELECT ITEM_ID, COUNT(*) AS component_count
  FROM item_components
  GROUP BY ITEM_ID
) cnt ON cnt.ITEM_ID = ic.ITEM_ID;

-- 2. Sample of assemblies with their input ratio.
--    Inspect these numbers against real pack/sack sizes.
SELECT ic.ITEM_ID,
       p.DESCRIPTION  AS assembled_item,
       ic.COMPONENT_ID,
       c.DESCRIPTION  AS input_item,
       ic.QUANTITY    AS input_qty_per_output_unit
FROM item_components ic
JOIN item p ON p.ID = ic.ITEM_ID
JOIN item c ON c.ID = ic.COMPONENT_ID
ORDER BY p.DESCRIPTION
LIMIT 100;

-- 3. Brown-sugar style lookup: replace the LIKE pattern with your case.
SELECT ic.ITEM_ID,
       p.DESCRIPTION  AS assembled_item,
       ic.COMPONENT_ID,
       c.DESCRIPTION  AS input_item,
       ic.QUANTITY    AS input_qty_per_output_unit,
       c.INACTIVE     AS input_inactive,
       c.PREFERRED_VENDOR_ID AS input_vendor_id
FROM item_components ic
JOIN item p ON p.ID = ic.ITEM_ID
JOIN item c ON c.ID = ic.COMPONENT_ID
WHERE p.DESCRIPTION LIKE '%brown sugar%'
   OR c.DESCRIPTION LIKE '%brown sugar%';

-- 4. Chains deeper than one level (assembled item whose input is itself an assembly).
SELECT ic.ITEM_ID        AS start_item,
       p.DESCRIPTION     AS start_description,
       ic.COMPONENT_ID   AS mid_item,
       m.DESCRIPTION     AS mid_description,
       (SELECT COUNT(*) FROM item_components sub WHERE sub.ITEM_ID = ic.COMPONENT_ID) AS mid_component_count
FROM item_components ic
JOIN item p ON p.ID = ic.ITEM_ID
JOIN item m ON m.ID = ic.COMPONENT_ID
WHERE EXISTS (SELECT 1 FROM item_components sub WHERE sub.ITEM_ID = ic.COMPONENT_ID);

-- 5. Recent builds confirming the transactional side is in use.
SELECT ba.ASSEMBLY_ITEM_ID,
       p.DESCRIPTION AS assembled_item,
       COUNT(*)      AS build_count,
       MAX(ba.DATE)  AS last_build_date
FROM build_assembly ba
JOIN item p ON p.ID = ba.ASSEMBLY_ITEM_ID
GROUP BY ba.ASSEMBLY_ITEM_ID, p.DESCRIPTION
ORDER BY last_build_date DESC
LIMIT 50;
