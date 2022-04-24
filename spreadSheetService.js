const { GoogleSpreadsheet } = require('google-spreadsheet');

class SpreadSheetService {
	/**
	 * コンストラクター
	 * @param {*} spreadsheetId スプレッドシートID
	 */
	constructor(spreadsheetId) {
		this.doc = new GoogleSpreadsheet(spreadsheetId);
	}
	/**
	 * サービスアカウントを用いて認証を行う
	 * @param {*} clientEmail
	 * @param {*} privateKey
	 */
	async authorize(clientEmail, privateKey) {
		await this.doc.useServiceAccountAuth({
			client_email: clientEmail,
			private_key: privateKey.replace(/\\n/g, '\n')
		});
	}
	/**
	 * 行データを返す
	 * @param {*} index
	 */
	async getRows(index) {
		await this.doc.loadInfo();
		const sheet = this.doc.sheetsByIndex[index];
		await sheet.loadHeaderRow(2);
		return sheet.getRows();
	}
	/**
	 * 行を追加する
	 * @param {*} value
	 */
	async insert(value) {
		await this.doc.loadInfo();
		const sheet = this.doc.sheetsByIndex[0];
		await sheet.loadHeaderRow(2);
		return await sheet.addRow(value, { insert: true });
	}
	/**
	 * データを取得する
	 */
	async select() {
		const rows = await this.getRows(0);
		return rows.map((row) => {
			const rawData = row._rawData;
			return {
				ID: rawData[1],
				PostDate: rawData[2],
				PostTime: rawData[3],
				PostUserName: rawData[4],
				PostText: rawData[5]
			};
		});
	}
	/**
	 * idに紐づくレコード情報を更新する
	 */
	async updateById(id, value) {
		const rows = await this.getRows(0);
		for (const row of rows) {
			const rawData = row._rawData;
			if (rawData[1] === id) {
				for (const attr in value) {
					row[attr] = value[attr];
					await row.save();
				}
			}
		}
	}
	/**
	 * idに紐づくユーザーを削除する
	 * @param {*} id
	 */
	async deleteById(id) {
		const rows = await this.getRows(0);
		for (const row of rows) {
			if (row.id == id) {
				await row.delete();
			}
		}
	}
}

module.exports = SpreadSheetService;
