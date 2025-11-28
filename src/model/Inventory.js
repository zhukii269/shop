export default class Inventory {
    constructor() {
        this.items = [];
    }

    init() {
        this.items = [
            // Common
            { id: 'tshirt', name: '短袖T恤', quantity: 10, cost: 10, price: 30, type: 'top', tags: ['cool', 'common'] },
            { id: 'jeans', name: '牛仔长裤', quantity: 8, cost: 15, price: 45, type: 'bottom', tags: ['common'] },
            { id: 'shirt', name: '普通衬衫', quantity: 8, cost: 12, price: 35, type: 'top', tags: ['common'] },
            { id: 'bag', name: '帆布包', quantity: 5, cost: 8, price: 25, type: 'accessory', tags: ['common'] },

            // Rain
            { id: 'umbrella', name: '雨伞', quantity: 5, cost: 15, price: 40, type: 'accessory', tags: ['rain'] },
            { id: 'raincoat', name: '雨衣', quantity: 5, cost: 20, price: 60, type: 'top', tags: ['rain'] },
            { id: 'boots', name: '防水靴', quantity: 5, cost: 25, price: 70, type: 'shoes', tags: ['rain'] },

            // Warm (Winter/Autumn)
            { id: 'down_jacket', name: '羽绒服', quantity: 5, cost: 50, price: 150, type: 'top', tags: ['warm'] },
            { id: 'scarf', name: '围巾', quantity: 5, cost: 10, price: 30, type: 'accessory', tags: ['warm'] },
            { id: 'sweater', name: '厚毛衣', quantity: 5, cost: 25, price: 80, type: 'top', tags: ['warm'] },

            // Cool (Summer)
            { id: 'sandals', name: '凉鞋', quantity: 5, cost: 12, price: 35, type: 'shoes', tags: ['cool'] },
            { id: 'sunhat', name: '遮阳帽', quantity: 5, cost: 10, price: 30, type: 'accessory', tags: ['cool'] }
        ];
    }

    removeItem(itemId) {
        const item = this.items.find(i => i.id === itemId);
        if (item && item.quantity > 0) {
            item.quantity--;
            return true;
        }
        return false;
    }

    hasStock(itemId) {
        const item = this.items.find(i => i.id === itemId);
        return item && item.quantity > 0;
    }

    getItemsByTag(tag) {
        return this.items.filter(i => i.tags && i.tags.includes(tag));
    }
}
