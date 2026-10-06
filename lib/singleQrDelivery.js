function createSingleQrDelivery() {
    let sent = false;
    let sending = false;

    return {
        async sendOnce(send) {
            if (sent || sending) return false;
            sending = true;
            try {
                await send();
                sent = true;
                return true;
            } finally {
                sending = false;
            }
        }
    };
}

module.exports = createSingleQrDelivery;
