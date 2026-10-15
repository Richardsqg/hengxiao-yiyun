export const FAVORITES = ['凤冠鉴赏', '文化寻根', '影像展厅'];
export const TOPICS = ['历史故事', '工艺技法', '纹样寓意', '课堂体验', '中西交流'];
export function validateFeedback(input) {
    if (!input || typeof input !== 'object')
        throw new Error('请填写观展问卷。');
    if (input.website)
        throw new Error('提交失败，请刷新后重试。');
    if (!/^[a-zA-Z0-9-]{20,64}$/.test(input.id || ''))
        throw new Error('提交标识无效，请刷新页面。');
    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5)
        throw new Error('请为本次观展体验评分。');
    if (!FAVORITES.includes(input.favorite))
        throw new Error('请选择印象最深的展区。');
    if (input.consent !== true)
        throw new Error('请确认同意将反馈提交给展馆管理员。');
    const nickname = typeof input.nickname === 'string' ? input.nickname.trim() : '';
    const message = typeof input.message === 'string' ? input.message.trim() : '';
    if (nickname.length > 30 || message.length > 1000)
        throw new Error('昵称最多30字，留言最多1000字。');
    const topics = Array.isArray(input.topics) ? [...new Set(input.topics.filter((t) => TOPICS.includes(t)))].slice(0, 5) : [];
    return { id: input.id, nickname: nickname || '匿名观众', rating: input.rating, favorite: input.favorite, topics, message };
}
export function sameOrigin(request) { const origin = request.headers.get('origin'); return !!origin && origin === new URL(request.url).origin; }
