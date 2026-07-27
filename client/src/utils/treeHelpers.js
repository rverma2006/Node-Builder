// Tree helper functions for manipulating the block structure in the builder


/**
 * Recursively maps a tree of blocks, applying a function to the block with the specified ID.
 * @param {Array} blocks - The tree of blocks to traverse.
 * @param {string} id - The ID of the block to apply the function to.
 * @param {Function} fn - The function to apply to the matching block.
 * @returns {Array} A new tree of blocks with the function applied to the matching block.
 */
export function treeMap(blocks, id, fn) {
  return blocks.map(b => {
    if (b.id === id) return fn(b);
    const mapped = { ...b, children: treeMap(b.children || [], id, fn) };
    if (b.buttons) {
      mapped.buttons = b.buttons.map(btn => ({
        ...btn, children: treeMap(btn.children || [], id, fn),
      }));
    }
    if (b.options) {
      mapped.options = b.options.map(opt => ({
        ...opt, children: treeMap(opt.children || [], id, fn),
      }));
    }
    if (b.bullets) {
      mapped.bullets = b.bullets.map(bullet => ({
        ...bullet, children: treeMap(bullet.children || [], id, fn),
      }));
    }
    return mapped;
  });
}


/**
 * Recursively filters a tree of blocks, removing the block with the specified ID.
 * @param {Array} blocks - The tree of blocks to traverse.
 * @param {string} id - The ID of the block to remove.
 * @returns {Array} A new tree of blocks with the specified block removed.
 */
export function treeFilter(blocks, id) {
  return blocks
    .filter(b => b.id !== id)
    .map(b => {
      const filtered = { ...b, children: treeFilter(b.children || [], id) };
      if (b.buttons) {
        filtered.buttons = b.buttons.map(btn => ({
          ...btn, children: treeFilter(btn.children || [], id),
        }));
      }
      if (b.options) {
        filtered.options = b.options.map(opt => ({
          ...opt, children: treeFilter(opt.children || [], id),
        }));
      }
      if (b.bullets) {
        filtered.bullets = b.bullets.map(bullet => ({
          ...bullet, children: treeFilter(bullet.children || [], id),
        }));
      }
      return filtered;
    });
}


/**
 * Adds a child to a whole block with the specified parent ID.
 * @param {Array} blocks - The tree of blocks to traverse.
 * @param {string} parentId - The ID of the parent block.
 * @param {Object} child - The child block to add.
 * @returns {Array} A new tree of blocks with the child added.
 */
export function treeAddToBlock(blocks, parentId, child) {
  return blocks.map(b => {
    if (b.id === parentId) return { ...b, children: [...(b.children || []), child] };
    const mapped = { ...b, children: treeAddToBlock(b.children || [], parentId, child) };
    if (b.buttons) {
      mapped.buttons = b.buttons.map(btn => ({
        ...btn, children: treeAddToBlock(btn.children || [], parentId, child),
      }));
    }
    if (b.options) {
      mapped.options = b.options.map(opt => ({
        ...opt, children: treeAddToBlock(opt.children || [], parentId, child),
      }));
    }
    if (b.bullets) {
      mapped.bullets = b.bullets.map(bullet => ({
        ...bullet, children: treeAddToBlock(bullet.children || [], parentId, child),
      }));
    }
    return mapped;
  });
}



/**
 * Adds a child for specifically a button within a block.
 * @param {Array} blocks - The tree of blocks to traverse.
 * @param {string} blockId - The ID of the block containing the button.
 * @param {string} btnId - The ID of the button to add the child to.
 * @param {Object} child - The child block to add.
 * @returns {Array} A new tree of blocks with the child added.
 */
export function treeAddToButton(blocks, blockId, btnId, child) {
  return blocks.map(b => {
    if (b.id === blockId) {
      return {
        ...b,
        buttons: b.buttons.map(btn =>
          btn.id === btnId ? { ...btn, children: [...(btn.children || []), child] } : btn
        ),
      };
    }
    const mapped = { ...b, children: treeAddToButton(b.children || [], blockId, btnId, child) };
    if (b.buttons) {
      mapped.buttons = b.buttons.map(btn => ({
        ...btn,
        children: treeAddToButton(btn.children || [], blockId, btnId, child),
      }));
    }
    if (b.options) {
      mapped.options = b.options.map(opt => ({
        ...opt,
        children: treeAddToButton(opt.children || [], blockId, btnId, child),
      }));
    }
    if (b.bullets) {
      mapped.bullets = b.bullets.map(bullet => ({
        ...bullet,
        children: treeAddToButton(bullet.children || [], blockId, btnId, child),
      }));
    }
    return mapped;
  });
}

/**
 * Moves a block within a list.
 * @param {Array} arr - The array of blocks to traverse.
 * @param {string} id - The ID of the block to move.
 * @param {number} dir - The direction to move the block (1 for down, -1 for up).
 * @returns {Array} A new array of blocks with the specified block moved.
 */
export function treeMoveInList(arr, id, dir) {
  const idx = arr.findIndex(b => b.id === id);
  if (idx !== -1) {
    const next = idx + dir;
    if (next < 0 || next >= arr.length) return arr;
    const a = [...arr];
    [a[idx], a[next]] = [a[next], a[idx]];
    return a;
  }
  return arr.map(b => {
    const mapped = { ...b, children: treeMoveInList(b.children || [], id, dir) };
    if (b.buttons) {
      mapped.buttons = b.buttons.map(btn => ({
        ...btn, children: treeMoveInList(btn.children || [], id, dir),
      }));
    }
    if (b.options) {
      mapped.options = b.options.map(opt => ({
        ...opt, children: treeMoveInList(opt.children || [], id, dir),
      }));
    }
    if (b.bullets) {
      mapped.bullets = b.bullets.map(bullet => ({
        ...bullet, children: treeMoveInList(bullet.children || [], id, dir),
      }));
    }
    return mapped;
  });
}



/**
 * Adds a child to a specific option within a block.
 * @param {Array} blocks - The tree of blocks to traverse.
 * @param {string} blockId - The ID of the block containing the option.
 * @param {string} optId - The ID of the option to add the child to.
 * @param {Object} child - The child block to add.
 * @returns {Array} A new tree of blocks with the child added.
 */
export function treeAddToOption(blocks, blockId, optId, child) {
  return blocks.map(b => {
    if (b.id === blockId) {
      return {
        ...b,
        options: (b.options || []).map(opt =>
          opt.id === optId ? { ...opt, children: [...(opt.children || []), child] } : opt
        ),
      };
    }
    const mapped = { ...b, children: treeAddToOption(b.children || [], blockId, optId, child) };
    if (b.buttons) {
      mapped.buttons = b.buttons.map(btn => ({
        ...btn,
        children: treeAddToOption(btn.children || [], blockId, optId, child),
      }));
    }
    if (b.options) {
      mapped.options = b.options.map(opt => ({
        ...opt,
        children: treeAddToOption(opt.children || [], blockId, optId, child),
      }));
    }
    if (b.bullets) {
      mapped.bullets = b.bullets.map(bullet => ({
        ...bullet,
        children: treeAddToOption(bullet.children || [], blockId, optId, child),
      }));
    }
    return mapped;
  });
}


/**
 * Adds a child to a specific bullet within a block.
 * @param {Array} blocks - The tree of blocks to traverse.
 * @param {string} blockId - The ID of the block containing the bullet.
 * @param {string} bulletId - The ID of the bullet to add the child to.
 * @param {Object} child - The child block to add.
 * @returns {Array} A new tree of blocks with the child added.
 */
export function treeAddToBullet(blocks, blockId, bulletId, child) {
  return blocks.map(b => {
    if (b.id === blockId) {
      return {
        ...b,
        bullets: (b.bullets || []).map(bullet =>
          bullet.id === bulletId
            ? { ...bullet, children: [...(bullet.children || []), child] }
            : bullet
        ),
      };
    }
    const mapped = { ...b, children: treeAddToBullet(b.children || [], blockId, bulletId, child) };
    if (b.buttons) {
      mapped.buttons = b.buttons.map(btn => ({
        ...btn,
        children: treeAddToBullet(btn.children || [], blockId, bulletId, child),
      }));
    }
    if (b.options) {
      mapped.options = b.options.map(opt => ({
        ...opt,
        children: treeAddToBullet(opt.children || [], blockId, bulletId, child),
      }));
    }
    if (b.bullets) {
      mapped.bullets = b.bullets.map(bullet => ({
        ...bullet,
        children: treeAddToBullet(bullet.children || [], blockId, bulletId, child),
      }));
    }
    return mapped;
  });
}