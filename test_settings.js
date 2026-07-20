const config = { deadlineKeywords: "hoàn thành trong ngày" };
const value = "hoàn thành trước ngày";

const current = config.deadlineKeywords || '';
const tags = current ? current.split(',').map(t => t.trim()).filter(Boolean) : [];

if (!tags.includes(value.trim())) {
    const newTags = [...tags, value.trim()].join(', ');
    const newConfig = { ...config, deadlineKeywords: newTags };
    console.log("newConfig:", newConfig);
    
    const isEvent = newConfig && (newConfig.nativeEvent || newConfig.target || newConfig.type);
    console.log("isEvent:", !!isEvent, "type:", newConfig.type);
    const payload = newConfig && !isEvent ? newConfig : config;
    console.log("payload:", payload);
}
