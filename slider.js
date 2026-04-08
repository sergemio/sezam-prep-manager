// Shared adaptive touch slider — used by both the Prep Manager (script.js)
// and the I&C Inventory (ic-inventory-app.js).
//
// Exposes two globals on window:
//   - window.computeSliderConfig(targetLevel, currentLevel)
//   - window.createTouchSlider(options)
//
// See docs/superpowers/specs/2026-04-08-adaptive-slider-design.md

// Compute slider range and step from an item's target level.
// Rules:
//   target <= 3     -> max = max(3, target*2), step 0.1
//   target 4 or 5   -> max = target*2, step 0.5
//   target > 5      -> max = ceil(target*1.5), step 1 (integers only)
// If current > computed max, expand max to ceil(current * 1.2) so the
// slider always includes the stored value.
function computeSliderConfig(targetLevel, currentLevel) {
    const target = parseFloat(targetLevel) || 0;
    const current = parseFloat(currentLevel) || 0;

    let max, step;
    if (target <= 0) {
        max = 20;
        step = null; // null = use legacy mixed steps
    } else if (target <= 3) {
        max = Math.max(3, target * 2);
        step = 0.1;
    } else if (target <= 5) {
        max = target * 2;
        step = 0.5;
    } else {
        max = Math.ceil(target * 1.5);
        step = 1;
    }

    if (current > max) {
        max = Math.ceil(current * 1.2);
    }

    const values = [];
    if (step === null) {
        for (let i = 0; i <= 12; i++) values.push(i * 0.25);
        for (let i = 4; i <= max; i++) values.push(i);
    } else if (step === 1) {
        for (let i = 0; i <= max; i++) values.push(i);
    } else {
        // Integer arithmetic to avoid float drift (0.1 + 0.2 problem)
        const stepInt = Math.round(step * 10);
        const maxInt = Math.round(max * 10);
        for (let i = 0; i <= maxInt; i += stepInt) {
            values.push(Math.round(i) / 10);
        }
    }

    return { min: 0, max: max, step: step, values: values };
}

// Reusable touch slider creation function
function createTouchSlider(options) {
    const {
        containerId,
        valueDisplayId,
        handleId,
        progressId,
        ticksId,
        decreaseId,
        increaseId,
        hiddenInputId,
        initialValue = 0,
        targetLevel = 0
    } = options;

    // DOM elements
    const container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    const valueDisplay = document.getElementById(valueDisplayId);
    const handle = document.getElementById(handleId);
    const progress = document.getElementById(progressId);
    const ticksContainer = document.getElementById(ticksId);
    const decreaseBtn = document.getElementById(decreaseId);
    const increaseBtn = document.getElementById(increaseId);
    const hiddenInput = document.getElementById(hiddenInputId);

    if (!container || !valueDisplay || !handle || !progress || !ticksContainer) {
        console.error('Missing required elements for slider');
        return null;
    }

    // Adaptive range and step based on target level
    let sliderConfig = computeSliderConfig(targetLevel, initialValue);
    let values = sliderConfig.values;
    let currentTarget = parseFloat(targetLevel) || 0;

    // Instance-specific state
    let currentValue = findClosestValue(parseFloat(initialValue) || 0, values);
    let isDragging = false;

    function findClosestValue(value, valueArray) {
        const exactIndex = valueArray.indexOf(value);
        if (exactIndex !== -1) return value;

        let closest = valueArray[0];
        let closestDiff = Math.abs(value - closest);

        for (const v of valueArray) {
            const diff = Math.abs(value - v);
            if (diff < closestDiff) {
                closestDiff = diff;
                closest = v;
            }
        }
        return closest;
    }

    function updateSlider() {
        const valueIndex = values.indexOf(currentValue);
        const percentage = valueIndex / (values.length - 1) * 100;

        handle.style.left = `${percentage}%`;
        progress.style.width = `${percentage}%`;

        // Format based on step: 0.1/0.5 → 1 decimal, integers → 0 decimal
        if (sliderConfig.step === 0.1 || sliderConfig.step === 0.5) {
            valueDisplay.textContent = currentValue.toFixed(1);
        } else if (sliderConfig.step === 1) {
            valueDisplay.textContent = currentValue.toFixed(0);
        } else {
            valueDisplay.textContent = currentValue < 3 ? currentValue.toFixed(2) : currentValue.toFixed(0);
        }

        if (hiddenInput) {
            hiddenInput.value = currentValue;
            const event = new Event('change');
            hiddenInput.dispatchEvent(event);
        }
    }

    function createTicks() {
        ticksContainer.innerHTML = '';

        values.forEach((val, index) => {
            const percentage = index / (values.length - 1) * 100;

            const tick = document.createElement('div');
            tick.className = val % 1 === 0 ? 'tick major' : 'tick';
            tick.style.left = `${percentage}%`;
            ticksContainer.appendChild(tick);

            const max = sliderConfig.max;
            let labelInterval;
            if (max <= 4) labelInterval = 1;
            else if (max <= 10) labelInterval = 2;
            else if (max <= 20) labelInterval = 5;
            else labelInterval = 10;

            if (val % 1 === 0 && val % labelInterval === 0) {
                const label = document.createElement('div');
                label.className = 'tick-label';
                label.textContent = val;
                label.style.left = `${percentage}%`;
                ticksContainer.appendChild(label);
            }
        });
    }

    function startDragging(e) {
        isDragging = true;
        e.preventDefault();
    }

    function stopDragging() {
        isDragging = false;
    }

    function handleMove(event) {
        if (!isDragging) return;

        const containerRect = container.getBoundingClientRect();
        const clientX = event.type.includes('touch') ?
            event.touches[0].clientX : event.clientX;
        let percentage = (clientX - containerRect.left) / containerRect.width;

        percentage = Math.max(0, Math.min(percentage, 1));

        const valueIndex = Math.round(percentage * (values.length - 1));
        currentValue = values[valueIndex];

        updateSlider();
        event.preventDefault();
    }

    function handleClick(event) {
        if (event.target === handle) return;

        const containerRect = container.getBoundingClientRect();
        const percentage = (event.clientX - containerRect.left) / containerRect.width;

        const valueIndex = Math.round(percentage * (values.length - 1));
        currentValue = values[valueIndex];

        updateSlider();
    }

    function decreaseValue() {
        const currentIndex = values.indexOf(currentValue);
        if (currentIndex > 0) {
            currentValue = values[currentIndex - 1];
            updateSlider();
        }
    }

    function increaseValue() {
        const currentIndex = values.indexOf(currentValue);
        if (currentIndex < values.length - 1) {
            currentValue = values[currentIndex + 1];
            updateSlider();
        }
    }

    handle.addEventListener('mousedown', startDragging);
    handle.addEventListener('touchstart', startDragging);

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('touchmove', handleMove, { passive: false });

    document.addEventListener('mouseup', stopDragging);
    document.addEventListener('touchend', stopDragging);

    container.addEventListener('click', handleClick);

    if (decreaseBtn) decreaseBtn.addEventListener('click', decreaseValue);
    if (increaseBtn) increaseBtn.addEventListener('click', increaseValue);

    // Target marker element (reused across reconfigures)
    let targetMarkerEl = null;
    function renderTargetMarker() {
        if (!currentTarget || currentTarget <= 0) {
            if (targetMarkerEl) targetMarkerEl.style.display = 'none';
            return;
        }
        if (!targetMarkerEl) {
            targetMarkerEl = document.createElement('div');
            targetMarkerEl.className = 'slider-target-marker';
            container.appendChild(targetMarkerEl);
        }
        targetMarkerEl.style.display = '';
        const pct = Math.min(100, Math.max(0, (currentTarget / sliderConfig.max) * 100));
        targetMarkerEl.style.left = `calc(${pct}% - 1.5px)`;
        targetMarkerEl.title = 'Target: ' + currentTarget;
    }

    // Initialize
    createTicks();
    renderTargetMarker();
    updateSlider();

    return {
        setValue: function(value) {
            currentValue = findClosestValue(value, values);
            updateSlider();
        },
        getValue: function() {
            return currentValue;
        },
        reconfigure: function(newTarget, newInitial) {
            currentTarget = parseFloat(newTarget) || 0;
            sliderConfig = computeSliderConfig(currentTarget, newInitial);
            values = sliderConfig.values;
            currentValue = findClosestValue(parseFloat(newInitial) || 0, values);
            createTicks();
            renderTargetMarker();
            updateSlider();
        },
        destroy: function() {
            handle.removeEventListener('mousedown', startDragging);
            handle.removeEventListener('touchstart', startDragging);
            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('touchmove', handleMove);
            document.removeEventListener('mouseup', stopDragging);
            document.removeEventListener('touchend', stopDragging);
            container.removeEventListener('click', handleClick);
            if (decreaseBtn) decreaseBtn.removeEventListener('click', decreaseValue);
            if (increaseBtn) increaseBtn.removeEventListener('click', increaseValue);
            if (targetMarkerEl && targetMarkerEl.parentNode) {
                targetMarkerEl.parentNode.removeChild(targetMarkerEl);
            }
        }
    };
}

// Expose on window for both script.js and ic-inventory-app.js
window.computeSliderConfig = computeSliderConfig;
window.createTouchSlider = createTouchSlider;
