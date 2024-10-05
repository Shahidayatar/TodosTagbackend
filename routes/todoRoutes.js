const Router = require('koa-router');
const { todos, tags } = require('../db'); 
module.exports = (router, db) => {

  // Get all todos
  router.get('/todos', async (ctx) => {
    await new Promise((resolve, reject) => {
      db.all('SELECT * FROM todos', [], async (err, todos) => {
        if (err) {
          reject(err);
        }

        // Fetch tags for each todo
        const todosWithTags = await Promise.all(
          todos.map(async (todo) => {
            const tags = await new Promise((resolveTags, rejectTags) => {
              db.all(
                `SELECT tags.id, tags.title FROM tags 
                 INNER JOIN todo_tags ON tags.id = todo_tags.tag_id 
                 WHERE todo_tags.todo_id = ?`,
                [todo.id],
                (err, rows) => {
                  if (err) {
                    rejectTags(err);
                  }
                  resolveTags(rows);
                }
              );
            });

            return {
              id: Number(todo.id),
              title: todo.title,
              order: todo.task_order,
              completed: todo.completed === 1,
              url: `http://${ctx.host}/todos/${todo.id}`,
              tags: tags.map((tag) => ({
                id: Number(tag.id),
                title: tag.title,
                url: `http://${ctx.host}/tags/${tag.id}`,
              })),
            };
          })
        );

        ctx.body = todosWithTags;
        resolve();
      });
    });
  });

  // Delete all todos
  router.del('/todos/', async (ctx) => {
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM todos', [], (err) => {
        if (err) {
          reject(err);
        }
        ctx.status = 204;
        resolve();
      });
    });
  });

  // POST /todos
  router.post('/todos', async (ctx) => {
    try {
      const { title, order } = ctx.request.body;

      if (!title) {
        ctx.status = 400;
        ctx.body = { error: 'Title is required' };
        return;
      }

      const newTodo = await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO todos (title, task_order, completed) VALUES (?, ?, ?)`,
          [title, order || 0, 0],
          function (err) {
            if (err) {
              console.error('Database error during insertion:', err.stack || err);
              reject(err);
              return;
            }
            resolve({
              id: this.lastID,
              title,
              order: order || 0,
              completed: false,
              url: `http://${ctx.host}/todos/${this.lastID}`,
              tags: [] // Initialize empty tags array for new todos
            });
          }
        );
      });

      ctx.body = newTodo;
      ctx.status = 201;
    } catch (error) {
      console.error('Unhandled error during POST /todos:', error.stack || error);
      ctx.status = 500;
      ctx.body = { error: `Internal Server Error: ${error.message}` };
    }
  });

  // Get a single todo by ID
  router.get('/todos/:id', async (ctx) => {
    const id = ctx.params.id;

    await new Promise((resolve, reject) => {
      const query = `
        SELECT todos.*, tags.id AS tag_id, tags.title AS tag_title
        FROM todos
        LEFT JOIN todo_tags ON todos.id = todo_tags.todo_id
        LEFT JOIN tags ON todo_tags.tag_id = tags.id
        WHERE todos.id = ?
      `;

      db.all(query, [id], (err, rows) => {
        if (err) {
          reject(err);
        }

        if (rows.length === 0) {
          ctx.throw(404, { error: 'Todo not found' });
          return;
        }

        const todo = {
          id: Number(rows[0].id),
          title: rows[0].title,
          order: rows[0].task_order,
          completed: rows[0].completed === 1,
          url: `http://${ctx.host}/todos/${rows[0].id}`,
          tags: rows
            .filter((row) => row.tag_id)
            .map((row) => ({
              id: Number(row.tag_id),
              title: row.tag_title,
              url: `http://${ctx.host}/tags/${row.tag_id}`,
            })),
        };

        ctx.body = todo;
        resolve();
      });
    });
  });

  // PATCH /todos/:id 
  router.patch('/todos/:id', async (ctx) => {
    const id = ctx.params.id;
    const { title, order, completed } = ctx.request.body;

    const fields = [];
    const values = [];

    if (title !== undefined) {
      fields.push('title = ?');
      values.push(title);
    }
    if (order !== undefined) {
      fields.push('task_order = ?');
      values.push(order);
    }
    if (completed !== undefined) {
      fields.push('completed = ?');
      values.push(completed ? 1 : 0);
    }

    if (fields.length === 0) {
      ctx.throw(400, { error: 'No valid fields to update' });
    }

    values.push(id);

    await new Promise((resolve, reject) => {
      db.run(`UPDATE todos SET ${fields.join(', ')} WHERE id = ?`, values, function (err) {
        if (err) {
          reject(err);
        }
        if (this.changes === 0) {
          ctx.throw(404, { error: 'Todo not found' });
        }
        resolve();
      });
    });

    // Return the updated Todo with tags
    await new Promise((resolve, reject) => {
      db.get('SELECT * FROM todos WHERE id = ?', [id], (err, todo) => {
        if (err) {
          reject(err);
        }
        if (!todo) ctx.throw(404, { error: 'Todo not found' });

        ctx.body = {
          id: Number(todo.id),
          title: todo.title,
          order: todo.task_order,
          completed: todo.completed === 1,
          url: `http://${ctx.host}/todos/${todo.id}`,
          tags: [] // Ensure that the updated todo also includes tags
        };
        resolve();
      });
    });
  });
  router.del("/todos/:id", async (ctx) => {
    const id = ctx.params.id;
    await new Promise((resolve, reject) => {
      db.run("DELETE FROM todos WHERE id = ?", [id], function (err) {
        if (err) {
          reject(err);
        }
        if (this.changes === 0) ctx.throw(404, { error: "Todo not found" });
        ctx.status = 204;
        resolve();
      });
    });
  });

    // Associate a tag with a todo
    router.post("/todos/:id/tags/", async (ctx) => {
      const todoId = ctx.params.id;
      const {id} = ctx.request.body;
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)`,
          [todoId, id],
          function (err) {
            if (err) {
              console.error(`Error creating association for Todo ${todoId} and Tag ${id}:`, err);
              reject(err);
              return;
            }
          //  console.log(`Successfully associated Tag ${id} with Todo ${todoId}. Rows affected: ${this.changes}`);
            if (this.changes === 0) {
              console.warn(`No association created. Check if the todo or tag does not exist. Todo ID: ${todoId}, Tag ID: ${id}`);
              ctx.throw(404, { error: `Association not created. Check if both todo and tag exist.` });
              return;
            }
    
            ctx.status = 200;
            ctx.body = { todo_id: Number(todoId), tag_id: Number(id) };
            resolve();
          }
        );
      });
    });
  
  // Get all tags associated with a todo
  router.get("/todos/:id/tags", async (ctx) => {
    const todoId = ctx.params.id;
  
    await new Promise((resolve, reject) => {
      db.all(
        `SELECT tags.id, tags.title 
         FROM tags 
         INNER JOIN todo_tags ON tags.id = todo_tags.tag_id 
         WHERE todo_tags.todo_id = ?`,
        [todoId],
        (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
        //  console.log(`Retrieved tags for todo ${todoId}:`, rows);
          ctx.body = rows.map((tag) => ({
            id: Number(tag.id),
            title: tag.title,
            url: `http://${ctx.host}/tags/${tag.id}`,
          }));
          resolve("success");
        }
      );
    });
  });
  
  // Remove a tag from a todo
  router.del("/todos/:id/tags/:tagId", async (ctx) => {
    const todoId = ctx.params.id;
    const tagId = ctx.params.tagId;
    // console.log("aaaaaaaaaa", todoId)
    await new Promise((resolve, reject) => {
      db.run(
        `DELETE FROM todo_tags WHERE todo_id = ? AND tag_id = ?`,
        [todoId, tagId],
        function (err) {
          if (err) {
            reject(err);
          }
          ctx.status = 204;
          resolve();
        }
      );
    });
  });

  // Remove all associated tags from a todo
  router.del("/todos/:id/tags/", async (ctx) => {
    const todoId = ctx.params.id;
    console.log(todoId);
    await new Promise((resolve, reject) => {
      db.run(
        `DELETE FROM todo_tags WHERE todo_id = ?`,
        [todoId],
        function (err) {
          if (err) {
            reject(err);
          }
          ctx.status = 204;
          resolve();
        }
      );
    });
  });
};
