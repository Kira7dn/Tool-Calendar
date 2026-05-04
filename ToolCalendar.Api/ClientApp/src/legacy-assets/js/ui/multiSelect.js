export function initMultiSelect({
    container,
    options,      // [{ id: ..., label: ... }, ...]
    selectedIds,  // initial selected array
    suggestedIds, // array for sorting and adding badge
    placeholder,
    onChange      // callback(newSelectedIds)
}) {
    const normalizeId = (value) => String(value);
    let currentSelected = [...(selectedIds || [])].map(normalizeId);
    const suggested = (suggestedIds || []).map(normalizeId);
    const inputIdPrefix = `ms-${container.id || 'multi'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    // Xếp hạng (Sorting) chỉ 1 lần
    const sortedOptions = [...options].sort((a, b) => {
        const aSug = suggested.includes(normalizeId(a.id));
        const bSug = suggested.includes(normalizeId(b.id));
        if (aSug && !bSug) return -1;
        if (!aSug && bSug) return 1;
        return a.label.localeCompare(b.label);
    });

    const wrapper = document.createElement('div');
    wrapper.className = 'multi-select-container';

    const triggerDiv = document.createElement('div');
    triggerDiv.className = 'multi-select-trigger';
    
    const dropdownDiv = document.createElement('div');
    dropdownDiv.className = 'multi-select-dropdown';

    const renderTrigger = () => {
        const selectedNames = sortedOptions
            .filter(o => currentSelected.includes(normalizeId(o.id)))
            .map(o => o.chipLabel || o.label);

        if (selectedNames.length === 0) {
            triggerDiv.innerHTML = `<span class="multi-select-placeholder">${escapeHtml(placeholder)}</span>`;
        } else if (selectedNames.length === 1) {
            triggerDiv.innerHTML = `<span class="selection-chip">${escapeHtml(selectedNames[0])}</span>`;
        } else {
            triggerDiv.innerHTML = `<span class="selection-chip">${escapeHtml(selectedNames[0])}</span> <span class="selection-summary-badge">+${selectedNames.length - 1}</span>`;
        }
    };

    const renderDropdown = () => {
        let optionsHtml = sortedOptions.map((o, index) => {
            const optionId = `${inputIdPrefix}-${index}`;
            const optionValue = normalizeId(o.id);
            return `
            <div class="multi-select-option" title="${escapeHtml(o.label)}">
                <input type="checkbox" id="${optionId}" value="${escapeHtml(optionValue)}">
                <label for="${optionId}">
                    ${escapeHtml(o.label)} 
                    ${suggested.includes(optionValue) ? '<span style="color:#10b981;font-size:0.8rem;margin-left:4px;font-weight:500">(Đề xuất)</span>' : ''}
                </label>
            </div>
        `;
        }).join('');
        
        dropdownDiv.innerHTML = optionsHtml;

        dropdownDiv.querySelectorAll('input').forEach(input => {
            const id = normalizeId(input.value);
            input.checked = currentSelected.includes(id);
            input.addEventListener('change', (e) => {
                e.stopPropagation();
                if (e.target.checked) {
                    if (!currentSelected.includes(id)) currentSelected.push(id);
                } else {
                    currentSelected = currentSelected.filter(v => v !== id);
                }
                renderTrigger();
                if (onChange) {
                    const nextIds = options
                        .map((option) => option.id)
                        .filter((optionId) => currentSelected.includes(normalizeId(optionId)));
                    onChange(nextIds);
                }
            });
        });
    };

    dropdownDiv.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    triggerDiv.addEventListener('click', (e) => {
        e.stopPropagation(); // prevent document listener from closing it instantly
        document.querySelectorAll('.multi-select-dropdown.active').forEach(d => {
            if (d !== dropdownDiv) d.classList.remove('active');
        });
        dropdownDiv.classList.toggle('active');
        
        if (dropdownDiv.classList.contains('active')) {
            const rect = triggerDiv.getBoundingClientRect();
            // float over table avoiding overflow constraints
            dropdownDiv.style.position = 'fixed';
            
            // Smart layout: Drop Up or Drop Down based on viewport space
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            
            if (spaceBelow < 220 && spaceAbove > spaceBelow) {
                dropdownDiv.style.top = 'auto';
                dropdownDiv.style.bottom = `${window.innerHeight - rect.top + 4}px`;
            } else {
                dropdownDiv.style.bottom = 'auto';
                dropdownDiv.style.top = `${rect.bottom + 4}px`;
            }
            
            dropdownDiv.style.left = `${rect.left}px`;
            dropdownDiv.style.minWidth = `${rect.width}px`;
            dropdownDiv.style.maxWidth = '300px';
        }
    });

    renderTrigger();
    renderDropdown();

    wrapper.appendChild(triggerDiv);
    
    // Add dropdown to body instead of wrapper to escape table overflow scrollbars
    document.body.appendChild(dropdownDiv);

    // Clean up if container is overwritten
    const observer = new MutationObserver((mutations) => {
        if (!document.body.contains(wrapper)) {
            dropdownDiv.remove();
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    container.innerHTML = '';
    container.appendChild(wrapper);
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
