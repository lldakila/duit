package api

import (
	"database/sql"
	"fmt"
	"net/http"

	"github.com/RadhiFadlillah/duit/internal/model"
	"github.com/julienschmidt/httprouter"
)

const pageLength = 250

// SelectAccounts is handler for GET /api/accounts
func (h *Handler) SelectAccounts(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	// Make sure session still valid
	h.auth.MustAuthenticateUser(r)

	// Start transaction
	// We only use it to fetch the data,
	// so just rollback it later
	tx := h.db.MustBegin()
	defer tx.Rollback()

	// Prepare SQL statement
	stmtSelectAccounts, err := tx.Preparex(`
		WITH income AS (
			SELECT account_id id, SUM(amount) amount FROM entry
			WHERE entry_type = 1
			GROUP BY account_id),
		expense AS (
			SELECT account_id id, SUM(amount) amount FROM entry
			WHERE entry_type = 2
			GROUP BY account_id),
		moved AS (
			SELECT account_id id, SUM(amount) amount FROM entry
			WHERE entry_type = 3
			GROUP BY account_id),
		received AS (
			SELECT affected_account_id id, SUM(amount) amount FROM entry
			WHERE entry_type = 3
			GROUP BY affected_account_id)
		SELECT a.id, a.name, 
			a.initial_amount + 
			IFNULL(i.amount, 0) - 
			IFNULL(e.amount, 0) - 
			IFNULL(m.amount, 0) + 
			IFNULL(r.amount, 0) total
		FROM account a
		LEFT JOIN income i ON i.id = a.id
		LEFT JOIN expense e ON e.id = a.id
		LEFT JOIN moved m ON m.id = a.id
		LEFT JOIN received r ON r.id = a.id`)
	checkError(err)

	// Fetch from database
	accounts := []model.Account{}
	err = stmtSelectAccounts.Select(&accounts)
	checkError(err)

	// Return accounts
	w.Header().Add("Content-Encoding", "gzip")
	w.Header().Add("Content-Type", "application/json")
	err = encodeGzippedJSON(w, &accounts)
	checkError(err)
}

// GetAccountEntries is handler for GET /api/account/:id
func (h *Handler) GetAccountEntries(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	// Make sure session still valid
	h.auth.MustAuthenticateUser(r)

	// Get URL parameter
	id := strToInt(ps.ByName("id"))
	page := strToInt(r.URL.Query().Get("page"))

	// Start transaction
	// We only use it to fetch the data,
	// so just rollback it later
	tx := h.db.MustBegin()
	defer tx.Rollback()

	// Prepare SQL statement
	stmtGetAccount, err := tx.Preparex(`SELECT id FROM account WHERE id = ?`)
	checkError(err)

	stmtGetEntriesMaxPage, err := tx.Preparex(`
		SELECT CEIL(COUNT(*) / ?) FROM entry
		WHERE account_id = ?
		OR affected_account_id = ?`)
	checkError(err)

	stmtSelectEntries, err := tx.Preparex(`
		SELECT id, account_id, affected_account_id, entry_type, description, amount, entry_date
		FROM entry
		WHERE account_id = ?
		OR affected_account_id = ?
		ORDER BY entry_date DESC, id DESC
		LIMIT ? OFFSET ?`)
	checkError(err)

	// Make sure account exist
	var tmpID int64
	err = stmtGetAccount.Get(&tmpID, id)
	checkError(err)

	if err == sql.ErrNoRows {
		panic(fmt.Errorf("account doesn't exist"))
	}

	// Get entry count and calculate max page
	var maxPage int
	err = stmtGetEntriesMaxPage.Get(&maxPage, pageLength, id, id)
	checkError(err)

	if page == 0 {
		page = 1
	} else if page > maxPage {
		page = maxPage
	}

	offset := (page - 1) * pageLength

	// Fetch entries from database
	entries := []model.Entry{}
	err = stmtSelectEntries.Select(&entries, id, id, pageLength, offset)
	checkError(err)

	// Return final result
	result := map[string]interface{}{
		"page":    page,
		"maxPage": maxPage,
		"entries": entries,
	}

	w.Header().Add("Content-Encoding", "gzip")
	w.Header().Add("Content-Type", "application/json")
	err = encodeGzippedJSON(w, &result)
	checkError(err)
}
