const pool = require('../db');

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function cancelPurchase(purchaseId, client) {
  const ownsTransaction = !client;
  const dbClient = client || await pool.connect();

  try {
    if (ownsTransaction) {
      await dbClient.query('BEGIN');
    }

    // Lock the purchase so concurrent cancellations cannot return its units twice.
    const purchaseResult = await dbClient.query(
      `SELECT id, project_id, units_purchased, status
         FROM purchase_records
        WHERE id = $1
          FOR UPDATE`,
      [purchaseId]
    );

    if (purchaseResult.rows.length === 0) {
      throw createError('Purchase not found', 404);
    }

    const purchase = purchaseResult.rows[0];

    if (purchase.status === 'cancelled') {
      throw createError('Purchase is already cancelled', 409);
    }

    if (purchase.status === 'certified') {
      throw createError('A certified purchase cannot be cancelled', 409);
    }

    // Lock the project row while restoring its available units.
    const projectResult = await dbClient.query(
      `SELECT id
         FROM offset_projects
        WHERE id = $1
          FOR UPDATE`,
      [purchase.project_id]
    );

    if (projectResult.rows.length === 0) {
      throw createError('Project not found', 404);
    }

    await dbClient.query(
      `UPDATE offset_projects
          SET units_remaining = units_remaining + $1
        WHERE id = $2`,
      [purchase.units_purchased, purchase.project_id]
    );

    await dbClient.query(
      `UPDATE purchase_records
          SET status = 'cancelled'
        WHERE id = $1`,
      [purchaseId]
    );

    if (ownsTransaction) {
      await dbClient.query('COMMIT');
    }

    return {
      purchaseId,
      unitsReturned: purchase.units_purchased,
    };
  } catch (error) {
    // If a client was passed in, the caller is responsible for rolling back.
    if (ownsTransaction) {
      try {
        await dbClient.query('ROLLBACK');
      } catch (rollbackError) {
        console.error(rollbackError);
      }
    }

    throw error;
  } finally {
    // Release only a connection this function obtained itself.
    if (ownsTransaction) {
      dbClient.release();
    }
  }
}

module.exports = { cancelPurchase };